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
import shlex
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


def _pip_hint(spec: str) -> str:
    """setup_wizard.pip_install_hint, imported lazily (one wording)."""
    from mt_eval_harness.setup_wizard import pip_install_hint
    return pip_install_hint(spec)


def _target_lang_inputs(config: dict) -> tuple[str, str]:
    """(code given, name given) for the run's target language."""
    code = str(config.get("target_code") or config.get("target_lang_code")
               or "").strip()
    name = str(config.get("target_lang") or config.get("target_language")
               or "").strip()
    return code, name


def _detect_lang_code(config: dict) -> str | None:
    """Extract the ISO 639-3 language code from the run config.

    Resolution chain — a CODE beats a NAME (synthetic hospital persona,
    Round 4: ``--target-lang Ambala_Ayta --target-lang-code abc`` resolved
    nothing, because only the name was tried):
        1. target_code (the corpus's / --target-lang-code's code) or
           target_lang_code, resolved through the language cards;
        2. target_lang / target_language — as a code, then as a name (also
           with underscores read as spaces: 'Ambala_Ayta' → 'Ambala Ayta');
        3. the target half of language_pair.

    Returns None if the language can't be identified; the caller says which
    value failed (unresolved_target_message).
    """
    code_given, name_given = _target_lang_inputs(config)
    candidates: list[str] = []
    if code_given:
        candidates.append(code_given)
    if name_given:
        candidates.append(name_given)
    if not candidates:
        # Try language_pair field (e.g. "en>crk" or "en-crk")
        pair = config.get("language_pair", "")
        if isinstance(pair, str) and pair:
            for sep in [">", "-", "_"]:
                if sep in pair:
                    candidates.append(pair.split(sep)[-1].strip())
                    break

    for target in candidates:
        if not target:
            continue
        # Try resolving as a code or alias first (handles "crk", "fr", etc.)
        resolved = resolve_code(target)
        if resolved != target or (len(target) == 3 and target.isalpha()):
            # Either the code resolved to something different (alias match),
            # or it's already a 3-letter ISO code
            return resolved.lower() if len(resolved) <= 3 else resolved
        # Try resolving as a human-readable name
        # Handles "Plains Cree (nêhiyawêwin, SRO)" → "crk"
        code = resolve_name(target)
        if not code and "_" in target:
            code = resolve_name(target.replace("_", " "))
        if code:
            return code
        # A 2-letter code (or an unregistered 2-3 letter one) as-is
        if len(target) <= 3 and target.isalpha():
            return target.lower()
    return None


def unresolved_target_message(config: dict) -> str:
    """What to tell the user when the target language does not resolve: the
    value that failed and how to fix it. The old warning said it could not
    find ``target_lang`` while listing ``target_lang`` among the keys present
    (synthetic hospital persona, Round 4)."""
    code_given, name_given = _target_lang_inputs(config)
    if code_given or name_given:
        tried = " and ".join(
            f"{label} {value!r}" for label, value in
            (("code", code_given), ("name", name_given)) if value)
        # A placeholder, never a concrete example code: "e.g. 'abc'" nudged
        # a user with an unconfirmed variety toward guessing one (Round 9
        # hospital persona).
        return (f"the target language ({tried}) matches no language card. "
                f"Pass --target-lang-code <ISO 639-3 code> if the language "
                f"has one (a variety not yet confirmed can use a private-use "
                f"code, qaa–qtz), or --target-lang with a name the cards know "
                f"(`champollion network card <code>` shows it).")
    return ("no target language was given (no --target-lang-code, "
            "--target-lang, or corpus language_pair). Pass "
            "--target-lang-code with its ISO 639-3 code.")


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
    glossary, _status = run_glossary(config)
    return TerminologyPlugin(glossary=glossary)


def _as_glossary(dictionary) -> dict[str, list[str]]:
    """{source term: [accepted translations]} from a coaching ``dictionary``.

    The champollion CLI's coaching dictionary maps a term to ONE string
    (cli/lib/terminology.js); the plugin takes a list of accepted forms.
    Both shapes are accepted; anything else in an entry is skipped.
    """
    out: dict[str, list[str]] = {}
    for term, target in (dictionary or {}).items():
        if not isinstance(term, str) or not term.strip():
            continue
        if isinstance(target, str) and target.strip():
            out[term] = [target]
        elif isinstance(target, list):
            forms = [t for t in target if isinstance(t, str) and t.strip()]
            if forms:
                out[term] = forms
    return out


def run_glossary(config: dict) -> tuple[dict[str, list[str]] | None, str]:
    """The terminology glossary for a run, and a one-line status saying why.

    Sources, in order:
      1. an explicit ``glossary`` on the config (the Python API);
      2. ``glossary_file`` (``--glossary``) — an evaluation input, never sent
         to the model; the same file for every run compared is what makes
         their terminology scores comparable;
      3. the ``dictionary`` object of a JSON ``--coaching-file`` — the scoring
         spec's coached-vocabulary rule ("only active when coaching data is
         present"). The status says so: the run is then scored against its
         own coaching.
    Before 2026-10-03 only the first existed and nothing on the command line
    set it, so terminology adherence was inactive on every CLI run, a
    cookbook-shaped coaching JSON included (synthetic hospital persona).
    """
    import json
    explicit = config.get("glossary")
    if isinstance(explicit, dict) and explicit:
        glossary = _as_glossary(explicit)
        if glossary:
            return glossary, f"glossary of {len(glossary)} term(s) from the run config"
    gpath = config.get("glossary_file")
    if gpath:
        try:
            data = json.loads(Path(gpath).read_text(encoding="utf-8"))
        except FileNotFoundError:
            raise SystemExit(f"  ✗ --glossary {gpath}: file not found")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as e:
            raise SystemExit(f"  ✗ --glossary {gpath}: not a JSON file ({e})")
        if isinstance(data, dict) and isinstance(data.get("dictionary"), dict):
            data = data["dictionary"]
        glossary = _as_glossary(data) if isinstance(data, dict) else {}
        if not glossary:
            raise SystemExit(
                f"  ✗ --glossary {gpath}: no terms — expected "
                '{"source term": "translation" or ["accepted", "forms"]}')
        return glossary, (f"glossary of {len(glossary)} term(s) from "
                          f"--glossary {Path(gpath).name}")
    inactive = ("no glossary (metric inactive) — pass --glossary <file.json> "
                "(the same file for every run you compare)")
    path = config.get("coaching_file")
    if not path:
        return None, inactive
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, f"no glossary (metric inactive) — coaching file {path} not found"
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None, inactive
    dictionary = data.get("dictionary") if isinstance(data, dict) else None
    glossary = _as_glossary(dictionary) if isinstance(dictionary, dict) else {}
    if not glossary:
        return None, inactive
    return glossary, (f"glossary of {len(glossary)} term(s) from the coaching "
                      "file's dictionary — the run is scored against its own "
                      "coaching; pass the same --glossary to every run you "
                      "compare for a like-for-like score")


def glossary_record(config: dict, *, given_at: str | None = None) -> dict | None:
    """Which glossary scored a run's terminology — recorded in its report.

    The same source order as :func:`run_glossary` (it is called to count the
    terms, so the record and the score can never name different glossaries):
    the config's ``glossary`` object, ``glossary_file`` (``--glossary``),
    then a JSON coaching file's ``dictionary``. ``{file, sha256, terms,
    given_at}`` — the file's NAME and the sha256 of its bytes (the content
    is never copied), or None when no glossary is active.

    ``given_at`` says which command supplied ``glossary_file`` ("mt-eval
    test --glossary" for one added at scoring time). A glossary given only to
    `mt-eval test` used to leave no trace in the report: compare showed
    "Glossary —" for it, while it had changed the composite (Round 9
    researcher)."""
    import hashlib
    import json as _json

    try:
        glossary, _status = run_glossary(config)
    except SystemExit as exc:
        # --glossary names a file that is gone or unreadable now: say so in
        # the record rather than drop it (scoring would have refused it).
        path = config.get("glossary_file")
        return {"file": Path(str(path)).name if path else None,
                "sha256": None, "terms": None,
                "given_at": given_at or "mt-eval run --glossary",
                "unreadable": str(exc).strip()}
    if not glossary:
        return None
    explicit = config.get("glossary")
    if isinstance(explicit, dict) and _as_glossary(explicit):
        blob = _json.dumps(explicit, sort_keys=True, ensure_ascii=False)
        return {"file": None,
                "sha256": hashlib.sha256(blob.encode("utf-8")).hexdigest(),
                "terms": len(glossary),
                "given_at": "the run config (a glossary object)"}
    for key, where in (("glossary_file", given_at or "mt-eval run --glossary"),
                       ("coaching_file", "the coaching file's dictionary")):
        path = config.get(key)
        if not path:
            continue
        try:
            sha = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        except OSError:
            continue
        return {"file": Path(str(path)).name, "sha256": sha,
                "terms": len(glossary), "given_at": where}
    return None


def glossary_label(record: dict | None, *, short: bool = False) -> str | None:
    """'gloss.json, sha256 1a2b3c4d5e6f…' — a glossary record in one phrase
    (``short``: 'gloss.json (1a2b3c4d)', for a table cell), or None for
    none."""
    if not isinstance(record, dict):
        return None
    name = record.get("file") or "glossary object"
    sha = record.get("sha256") or ""
    if not sha:
        return name
    return f"{name} ({sha[:8]})" if short else f"{name}, sha256 {sha[:12]}…"


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
    """Check the runtime dependencies of a metric plugin.

    Checks pip dependencies and spaCy models listed in the metric declaration.
    If anything is missing it prints the exact install commands and returns
    False — it never installs (installing is the user's explicit step).

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

    # Report what's missing — and how to install it. Nothing is installed
    # here: a scoring run installs no package (it used to offer a pip install
    # mid-run; installing is the explicit `mt-eval setup` step, or the pip
    # command printed below — synthetic school persona, Round 6).
    all_missing = missing_deps + [f"spaCy model: {m}" for m in missing_models]
    print(f"  {name}: missing dependencies: {', '.join(all_missing)}")
    for dep in missing_deps:
        from mt_eval_harness.setup_wizard import pip_install_hint
        print(f"    install: {pip_install_hint(dep)}")
    for model_name in missing_models:
        print(f"    install: python -m spacy download {shlex.quote(model_name)}")

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
    """Check that the package(s) providing a card's evalMetrics are importable.

    The harness core ships NO language-specific scorer code. If a card's
    evalMetrics name modules whose top-level package is not installed, raise
    :class:`EvalStandardMissing` naming the exact ``pip install`` of the
    card's ``evalStandard.pip`` — never install it (it used to, unasked, in
    any non-interactive run). FAIL LOUD — a declared eval standard that can't
    be loaded is a hard error, never a silent skip; ``--skip-eval-standard``
    is the explicit way to score without it (discover_metric_plugins then
    marks the metrics not computed).
    """
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
        raise EvalStandardMissing(
            f"The {lang_code!r} language card declares eval metrics from "
            f"{missing}, but that package is not installed and the card has no "
            f"'evalStandard.pip' to fetch it. Refusing to silently skip the "
            f"language's referee metrics — install it or fix the card "
            f"(or pass --skip-eval-standard to score without them, marked "
            f"not computed)."
        )

    # Nothing is installed here. A scoring run used to pip-install the
    # package itself whenever stdin was not a terminal (an agent's job, CI);
    # installing is now always the user's explicit step — the command below.
    # The card-declared IP / data-sovereignty notice is shown here, before
    # they install it, since this is now the first touchpoint.
    ip_notice = (eval_standard or {}).get("ipNotice")
    notice = ""
    if ip_notice:
        notice = (f"\n  IP / DATA-SOVEREIGNTY NOTICE — {pkg_label}:\n"
                  + "\n".join(f"    {line}"
                              for line in str(ip_notice).splitlines()))
    raise EvalStandardMissing(
        f"{lang_code}: the eval-standard package '{pkg_label}' (it provides "
        f"this language's referee metrics: {', '.join(sorted(eval_metrics))}) "
        f"is not installed, and scoring installs nothing. Install it:\n"
        f"    {_pip_hint(pip_spec)}\n"
        f"    mt-eval setup --lang {lang_code}   (its remaining dependencies)\n"
        f"  or pass --skip-eval-standard to score without these metrics "
        f"(the run card marks them not computed).{notice}"
    )


class EvalStandardMissing(RuntimeError):
    """A card's eval-standard package is not installed — with the exact
    install command. Scoring never installs it (see
    _ensure_eval_standard_installed)."""


class _WithheldCardMetric:
    """Stands in for a card-declared metric that was deliberately NOT loaded.

    It computes nothing; its aggregate carries the reason, so the report says
    why the metric is missing and publish turns that into the run card's
    ``metric_availability`` (publish._build_metric_availability) instead of
    the false "no linter declared on this language's card".
    """

    def __init__(self, name: str, reason: str):
        self.name = name
        self.reason = reason

    def compute(self, entry: dict) -> dict:
        return {}

    def aggregate(self, entry_results: list[dict]) -> dict:
        return {"unavailable": self.reason}


class _SkippedFSTMetric:
    """Stands in for the FST metric when the run is scored without it — by
    choice (--skip-fst) or because the FST lane is not installed on this
    machine (an advisory since Round 8). It computes nothing; its aggregate
    carries the reason as
    the FST family's ``error``, which publish._build_metric_availability
    turns into ``fst_acceptance_rate: unavailable: <reason>`` — not the false
    "no GiellaLT FST installed/declared for this language"."""

    name = "giellalt_fst_validity"

    def __init__(self, reason: str):
        self.reason = reason

    def compute(self, entry: dict) -> dict:
        return {}

    def aggregate(self, entry_results: list[dict]) -> dict:
        return {"error": self.reason}


def _skipped_language_card_metrics(lang_code: str, why: str) -> list:
    """Stand-ins for every card-declared metric when the user chose to score
    without them (--skip-eval-standard) — marked not computed, with why."""
    from mt_eval_harness import language_cards as _lc

    eval_metrics = _lc.get_eval_metrics(lang_code)
    if not eval_metrics:
        return []
    reason = f"not computed: {why}"
    print(f"  Language card eval metrics: NOT loaded for {lang_code} "
          f"({', '.join(sorted(eval_metrics))}) — {why}. The run is scored "
          f"without them and the run card says so.")
    return [_WithheldCardMetric(name, reason) for name in sorted(eval_metrics)]


def _remote_lookup_refusal(config: dict) -> str | None:
    """Why this run's corpus may reach no outside service, or None.

    The same answer the provider gate acts on: the run's resolved
    transmission policy (sealed: a steward's local-only mark, a held-out /
    gold-standard segment, a quarantined set), plus — strictness only — a
    local-only mark on the corpus files themselves, which a log scored
    before the mark existed would not carry.
    """
    from mt_eval_harness.corpus_loader import marked_local_only
    from mt_eval_harness.transmission_policy import MODE_SEALED

    policy = config.get("transmission_policy") or {}
    reason = str(policy.get("reason") or "")
    if (marked_local_only(config.get("corpus_path"), config.get("source_file"),
                          config.get("reference_file"))
            or (policy.get("mode") == MODE_SEALED and "local-only" in reason)):
        return "local-only corpus"
    if policy.get("mode") == MODE_SEALED:
        return f"sealed corpus ({reason or 'sealed'})"
    return None


def _withheld_language_card_metrics(lang_code: str, refusal: str) -> list:
    """Stand-ins for every card-declared metric, when the corpus may not leave.

    A card's eval-standard metrics live in an external package that can look
    words up on an outside service — the Cree standard queried a public
    dictionary with words from a local-only school test set (synthetic Cree-
    school persona, 2026-10-03). Nothing on the card says a metric is offline
    (the language-card schema has no such field), so none is loaded, and the
    package is not even installed for this run.
    """
    from mt_eval_harness import language_cards as _lc

    eval_metrics = _lc.get_eval_metrics(lang_code)
    if not eval_metrics:
        return []
    reason = (f"{refusal}: this metric comes from the language's eval-standard "
              f"package, which can look words up on an outside service, so it "
              f"was not loaded and no sentence leaves this machine")
    print(f"  Language card eval metrics: NOT loaded for {lang_code} "
          f"({', '.join(sorted(eval_metrics))}) — {refusal}: they can look "
          f"words up on an outside service. The run is scored without them "
          f"and the run card says so.")
    return [_WithheldCardMetric(name, reason) for name in sorted(eval_metrics)]


def _load_language_card_metrics(lang_code: str) -> list:
    """Load evaluation metrics declared on the language card (the REFEREE rubric).

    The card's ``evalMetrics`` field declares metrics that apply to ALL
    evaluations targeting this language, regardless of which method produced the
    output — they live with the language, not the contestant. The harness core
    ships none of this code: a ``module`` is a FULL importable path into an
    external eval-standard package (e.g. ``champollion_lyss.crk.metrics``),
    which the user installs from the card's ``evalStandard.pip`` (the harness
    names the command and installs nothing — _ensure_eval_standard_installed).

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


def load_style_profile(config: dict):
    """The run's --style-profile as a StyleProfile, None when none was asked
    for. A profile that WAS asked for and cannot be read is a refusal
    (SystemExit), never a printed warning and a run scored without it — an
    explicitly requested scoring input is honoured or the run stops
    (synthetic hospital persona, Round 4). The CLI calls this before the run
    spends anything (preflight_scoring_inputs)."""
    import json
    raw = config.get("style_profile")
    if not raw:
        return None
    from mt_eval_harness.plugins.writing_style import StyleProfile
    path = Path(str(raw)).expanduser()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"  ✗ --style-profile {raw}: file not found")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as e:
        raise SystemExit(f"  ✗ --style-profile {raw}: not a JSON file ({e})")
    if not isinstance(data, dict):
        raise SystemExit(f"  ✗ --style-profile {raw}: expected a JSON object")
    try:
        return StyleProfile.from_dict(data)
    except (TypeError, ValueError, KeyError) as e:
        raise SystemExit(f"  ✗ --style-profile {raw}: not a style profile ({e})")


def preflight_scoring_inputs(config: dict) -> None:
    """Refuse, BEFORE anything is spent, a scoring input the run was asked
    for and cannot honour: an unreadable or empty --glossary, an unreadable
    --style-profile, --fuse / --metricx without their dependencies. Both used to surface only at scoring time — after the
    translations were paid for — or not at all (synthetic hospital persona,
    Round 4). Also says up front when the target language resolves to no
    card, so language-specific scoring will not run (the generic metrics
    still do)."""
    if config.get("glossary_file") or config.get("glossary"):
        run_glossary(config)          # raises SystemExit on a bad glossary
    load_style_profile(config)        # raises SystemExit on a bad profile
    # Opt-in neural comparators: asked for, so they must be computable — they
    # used to print "requested but unavailable" at scoring time, after the
    # translations were paid for, and report None.
    if config.get("compute_fuse"):
        from mt_eval_harness.metrics_fuse import HAS_LABSE
        if not HAS_LABSE:
            raise SystemExit(
                "  ✗ --fuse was requested but its LaBSE dependency is not "
                f"installed: {_pip_hint('mt-eval-harness[fuse]')} (or drop "
                "--fuse). Nothing was spent.")
    if config.get("compute_metricx"):
        from mt_eval_harness.metrics_metricx import HAS_METRICX
        if not HAS_METRICX:
            raise SystemExit(
                "  ✗ --metricx was requested but MetricX is not installed: "
                f"{_pip_hint('mt-eval-harness[metricx]')} and "
                f"{_pip_hint('git+https://github.com/google-research/metricx')}"
                " (or drop --metricx). Nothing was spent.")
    if _detect_lang_code(config) is None:
        print(f"  ⚠ Language-specific scoring will not run: "
              f"{unresolved_target_message(config)} The generic metrics "
              f"(code-switching, hallucination, terminology, writing style) "
              f"still run.")


def _generic_plugins(config: dict) -> list:
    """The plugins that need no resolved target language: code-switching,
    hallucination, terminology (with the run's glossary) and writing style.
    Loaded for EVERY run — a target language the cards do not know must not
    drop them (nor a glossary the user asked to be scored)."""
    out: list = []
    # --- Behavioral plugins (language-agnostic, always loaded) ---
    # These detect specific failure modes in translation output.
    # They apply to all language pairs — no language-specific tools needed.
    # Scoring weights reference these metrics (code_switching_rate: 0.05–0.10,
    # hallucination_rate: 0.05, terminology_adherence: 0.05), so they must
    # be loaded for the composite to include them.

    cs_plugin = _load_code_switching()
    out.append(cs_plugin)
    print("  Code-switching: loaded (CodeSwitchingPlugin — source-language leakage)")

    hall_plugin = _load_hallucination()
    out.append(hall_plugin)
    print("  Hallucination: loaded (HallucinationPlugin — fabricated content)")

    term_plugin = _load_terminology(config)
    out.append(term_plugin)
    _glossary, glossary_status = run_glossary(config)
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
        style_profile = load_style_profile(config)
        if style_profile is not None:
            print(f"  Writing style: loaded with profile from "
                  f"{Path(str(config.get('style_profile'))).name}")
        else:
            print("  Writing style: loaded (no profile — auto-detecting from corpus)")

        style_plugin = WritingStyleMetric(style_profile=style_profile)
        out.append(style_plugin)
    except ImportError as e:
        # Should not happen — plugin ships with the harness
        logger.warning("WritingStyleMetric failed to import: %s", e)

    return out


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def discover_metric_plugins(
    config: dict,
    skip_fst: bool = False,
    method_dir: str | Path | None = None,
    *,
    exclude_fst: bool | None = None,
    skip_eval_standard: bool | None = None,
) -> list:
    """Auto-discover metric plugins appropriate for the target language.

    This is the main entry point for plugin auto-discovery. It:
        1. Detects the target language from the config dict
        2. Checks if the language has a known GiellaLT FST
        3. Loads the FST metric when the FST lane is installed, else a
           stand-in that marks it not computed (never prompts, never
           installs, never stops)
        4. Loads language-card-declared eval metrics (e.g., LYSS for CRK)
        5. Falls back to method-declared metrics only if the language
           card has no evalMetrics

    The harness is **language-neutral** and the core wheel ships NO
    language-specific scorer code. Language-specific metrics are declared on the
    language card under "evalMetrics"/"evalStandard" and loaded from external
    packages (e.g. champollion-lyss) the user installs (never auto-installed).

    Args:
        config: Dict containing at least 'target_lang' or 'target_language'.
                Can be a RunConfig.__dict__, a run_log['config'], or similar.
        skip_fst: Kept for callers. Every run now uses an FST only when it
                  is already installed (never a prompt or a download); this
                  flag changes nothing any more.
        method_dir: Path to the method plugin directory containing method.json.
                    If provided, loads metric plugins declared in the manifest.
                    If None, auto-detects from monorepo structure.
        exclude_fst: The user's --skip-fst: score WITHOUT the FST even when
                  one is installed; a stand-in marks it not computed. None
                  reads ``config["skip_fst"]`` (a RunConfig field).
        skip_eval_standard: The user's --skip-eval-standard: score without
                  the card's eval-standard metrics; stand-ins mark them not
                  computed. None reads ``config["skip_eval_standard"]``.

    Returns:
        List of MetricPlugin instances (may be empty).

    A missing FST lane never raises: it is marked not computed with the
    install command and the re-score (Round 8).
    """
    plugins = []

    lang_code = _detect_lang_code(config)
    lang_name = _detect_lang_name(config)

    if lang_code is None:
        # Language-SPECIFIC scoring (the FST, the card's metrics) needs a
        # resolved language; the generic plugins below do not, and they
        # always load. This used to `return []` here — every plugin dropped,
        # a requested --glossary silently unscored, exit 0 (synthetic
        # hospital persona, Round 4).
        print(f"  ⚠ Language-specific scoring not loaded: "
              f"{unresolved_target_message(config)} The generic metrics "
              f"(code-switching, hallucination, terminology, writing style) "
              f"still run.")
        if method_dir is not None:
            # A method's own diagnostics name no language either.
            plugins.extend(_load_method_metric_plugins(method_dir))
        plugins.extend(_generic_plugins(config))
        return plugins

    # --- FST quality gate ---
    from mt_eval_harness.plugins.fst_installer import ensure_fst_available
    from mt_eval_harness import language_cards as _lc

    if exclude_fst is None:
        exclude_fst = bool(config.get("skip_fst"))
    if skip_eval_standard is None:
        skip_eval_standard = bool(config.get("skip_eval_standard"))

    fst_install_info = _lc.get_fst_install_info(lang_code)
    if fst_install_info is not None and exclude_fst:
        print(f"  FST metric: not computed (--skip-fst) for {lang_code}")
        plugins.append(_SkippedFSTMetric(
            "not computed: the run was scored with --skip-fst (FST "
            "acceptance and morphology left out by choice; `mt-eval setup "
            f"--lang {lang_code}` installs the FST)"))
    elif fst_install_info is not None:
        # A missing FST lane is an ADVISORY, never a stop and never a prompt
        # (Round 8: scoring stopped here — or offered a download on a
        # terminal — unless --skip-fst, so a Cree school whose agent host
        # refused both the install and the "bypass" flag got no baseline at
        # all, while nmt-forge scored the same test set and marked FST not
        # computed). The analyzer and its runtime are installed only by
        # `mt-eval setup --lang <code>`; `mt-eval test <run log>` then adds
        # the metric to a finished run without re-translating. ``skip_fst``
        # keeps its old meaning for callers — use an installed FST only —
        # which is now what every run does.
        from mt_eval_harness.config import fst_state
        state = fst_state(lang_code) or {}
        if state.get("ready"):
            fst_dir = ensure_fst_available(lang_code, lang_name, skip_fst=True)
            from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric
            fst_plugin = GiellaLTFSTMetric(lang_code=lang_code, fst_dir=fst_dir)
            plugins.append(fst_plugin)
            print(f"  FST metric: registered (GiellaLTFSTMetric for {lang_code})")
        else:
            pieces = state.get("missing") or ["the FST"]
            missing = (" and ".join(pieces)
                       + (" is" if len(pieces) == 1 else " are"))
            setup = state.get("setup_command")
            print(f"  FST metric: not computed — {state.get('line', '')} "
                  f"After installing, `mt-eval test <run log>` re-scores the "
                  f"run without re-translating.")
            plugins.append(_SkippedFSTMetric(
                f"not computed: {missing} not installed on the machine that "
                f"scored this run (nothing downloads by itself"
                + (f"; `{setup}` installs it" if setup else
                   "; the analyzer is a manual install — see the language "
                   "card's FST install notes")
                + "; `mt-eval test <run log>` then re-scores without "
                  "re-translating)"))

    # --- Language-card-declared eval metrics (REFEREE — applies to all methods) ---
    # These are the official evaluation standards for this language.
    # They come from the language card's evalMetrics field, NOT from any
    # translation method's method.json. This ensures fair scoring.
    if lang_code:
        refusal = _remote_lookup_refusal(config)
        if refusal:
            plugins.extend(_withheld_language_card_metrics(lang_code, refusal))
        elif skip_eval_standard:
            plugins.extend(_skipped_language_card_metrics(
                lang_code, "the run was scored with --skip-eval-standard"))
        else:
            try:
                card_metrics = _load_language_card_metrics(lang_code)
            except EvalStandardMissing as e:
                # The card's eval standard is an optional add-on package with
                # its own licence (the Cree standard is experimental and not
                # part of the core harness). Not installed → score without
                # it, marked not computed, with the install command — never
                # stop a run for it, never install it unasked. Whether a
                # language's standard should be REQUIRED is a founder call.
                print(f"  {e}")
                card_metrics = None
                plugins.extend(_skipped_language_card_metrics(
                    lang_code, "its optional eval-standard package is not "
                    "installed (the command above adds it)"))
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
    plugins.extend(_generic_plugins(config))

    loaded = [p for p in plugins if not isinstance(p, _WithheldCardMetric)]
    if loaded:
        print(f"  Auto-discovered {len(loaded)} metric plugin(s) for {lang_code}")

    return plugins
