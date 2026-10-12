"""
Run Harness Configuration — All configurable knobs in one place.

Every parameter that affects a harness run is defined here as a typed
dataclass field. The config is serialized into every RunLog for full
reproducibility — any logged result can be exactly reproduced by
loading its config snapshot.

The TranslationMethod protocol defines the plugin interface: any
callable that takes structured input and returns structured output
can be registered as a translation method.

┌──────────────────────────────────────────────────────────────────┐
│  PERFORMANCE DEFAULTS — "Fast by default, safe by design"       │
│                                                                  │
│  The harness ships with aggressive defaults because:             │
│    • batch_size=25 cuts API calls by 25×                         │
│    • max_tokens=32768 eliminates truncation risk entirely        │
│    • concurrency=8 maximizes throughput per model                │
│    • cache=on prevents redundant API calls                       │
│                                                                  │
│  For multi-model runs, use execute_multi_run() to run all        │
│  models in parallel. Each gets its own session and semaphore.    │
│                                                                  │
│  All defaults are defined as constants below (search for         │
│  HARNESS_DEFAULTS). Change them in ONE place.                    │
└──────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import shlex
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataset registry — discover and resolve evaluation datasets
# ---------------------------------------------------------------------------

# Registry resolution. Default order (no explicit path) — local → bundled →
# remote — is what lets a standalone `pip install` auto-download corpora with
# NO local files: the wheel ships a bundled registry and refreshes it from the
# web (always current; new corpora reach users without a harness release).
#   1. arena/datasets/registry.json        — in-repo checkout / public mirror
#   2. arena/datasets/registry-*.json       — split files (merged)
#   3. mt_eval_harness/data/registry.json   — bundled in the wheel (pip, offline)
#   4. champollion.dev/registry.json        — fetched + cached (pip, current)
_PACKAGE_DIR = Path(__file__).parent
_REGISTRY_PATH = _PACKAGE_DIR.parent / "datasets" / "registry.json"
_REGISTRY_DIR = _PACKAGE_DIR.parent / "datasets"
_BUNDLED_REGISTRY = _PACKAGE_DIR / "data" / "registry.json"

# Remote registry — published alongside queue.json. Env-overridable for
# staging/tests; MT_EVAL_NO_REMOTE_REGISTRY=1 disables all network use.
_REGISTRY_URL = os.environ.get(
    "MT_EVAL_REGISTRY_URL", "https://champollion.dev/registry.json"
)
# The ONE user-level cache root for re-fetchable data (registry, cards index,
# fetched corpora). Credentials and node state live elsewhere (~/.mt-eval/).
# The directory name still carries the pre-2026-08-27 package name
# ("gds-mt-eval"); renaming it would orphan every existing user cache for a
# cosmetic gain, so the name stays and this constant is the single place a
# future rename (with a backward-compatible read of the old path) would go.
_CACHE_ROOT = Path.home() / ".cache" / "gds-mt-eval"
_REGISTRY_CACHE = _CACHE_ROOT / "registry.json"
_REGISTRY_CACHE_TTL = 24 * 3600  # seconds — refresh at most once a day


def _merge_split_registry(registry_dir: Path) -> dict | None:
    """Merge every registry-*.json in a dir (tagging registry_source).

    Returns the merged registry, or None when the dir has no split files.
    """
    split_files = sorted(registry_dir.glob("registry-*.json"))
    if not split_files:
        return None
    merged: dict = {"registry_version": "3.0.0", "datasets": []}
    for split_path in split_files:
        source_name = split_path.stem.replace("registry-", "")
        reg = json.loads(split_path.read_text(encoding="utf-8"))
        for ds in reg.get("datasets", []):
            ds["registry_source"] = source_name
        merged["datasets"].extend(reg.get("datasets", []))
    return merged


def _load_remote_registry() -> dict | None:
    """Fetch the registry from the web, cached with a TTL. None on failure.

    A standalone install with no local/bundled registry uses this to stay
    current. Network failures are non-fatal: a stale cache is reused if
    present, otherwise None (the caller raises a clear error). Disabled with
    MT_EVAL_NO_REMOTE_REGISTRY=1 for air-gapped use.
    """
    if os.environ.get("MT_EVAL_NO_REMOTE_REGISTRY", "").lower() in ("1", "true", "yes"):
        return None

    # Fresh cache → use it without touching the network.
    if _REGISTRY_CACHE.is_file():
        age = time.time() - _REGISTRY_CACHE.stat().st_mtime
        if age < _REGISTRY_CACHE_TTL:
            try:
                return json.loads(_REGISTRY_CACHE.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass  # corrupt cache — refetch below

    import urllib.error
    import urllib.request
    from mt_eval_harness.net_json import NotJSONResponseError, parse_json_response
    try:
        logger.info("Fetching dataset registry from %s", _REGISTRY_URL)
        with urllib.request.urlopen(_REGISTRY_URL, timeout=30) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()
        # A gated/down host can answer HTTP 200 with an HTML holding page —
        # parse strictly so the warning below says so, instead of a cryptic
        # JSONDecodeError position.
        registry = parse_json_response(data, content_type=content_type)
        _REGISTRY_CACHE.parent.mkdir(parents=True, exist_ok=True)
        _REGISTRY_CACHE.write_text(data.decode("utf-8"), encoding="utf-8")
        return registry
    except (urllib.error.URLError, OSError, json.JSONDecodeError, ValueError) as exc:
        if isinstance(exc, NotJSONResponseError):
            problem = (f"not serving the registry (got {exc.got}) — "
                       f"the site may be gated or down")
        else:
            problem = str(exc)
        # Fall back to a stale cache if one exists — better than nothing.
        if _REGISTRY_CACHE.is_file():
            logger.warning(
                "Could not refresh registry from %s (%s); using cached copy.",
                _REGISTRY_URL, problem,
            )
            try:
                return json.loads(_REGISTRY_CACHE.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return None
        logger.warning("Could not fetch registry from %s: %s",
                       _REGISTRY_URL, problem)
        return None


def load_registry(registry_path: Path | None = None) -> dict:
    """Load the dataset registry.

    An explicit ``registry_path`` (a ``.json`` file or a directory of
    ``registry-*.json``) is used strictly — no network fallback. With no
    argument, resolution is local → bundled → remote (see the module-level
    notes), so a standalone install needs no local files. Entries loaded from
    split files are tagged with ``registry_source``.

    Raises:
        FileNotFoundError: only when every source is exhausted.
    """
    # --- Explicit path: strict (single file or a dir of split files) ---
    if registry_path is not None:
        if registry_path.is_file():
            return json.loads(registry_path.read_text(encoding="utf-8"))
        if registry_path.is_dir():
            merged = _merge_split_registry(registry_path)
            if merged is not None:
                return merged
        # Back-compat: an explicit-but-missing path falls back to the default
        # single file if present, else raises. No network for explicit paths.
        if _REGISTRY_PATH.is_file():
            return json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
        raise FileNotFoundError(
            f"No dataset registry found at the given path: {registry_path}"
        )

    # --- Default resolution: local → bundled → remote ---
    if _REGISTRY_PATH.is_file():                    # (1) in-repo / mirror clone
        return json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))

    merged = _merge_split_registry(_REGISTRY_DIR)    # (2) split files
    if merged is not None:
        return merged

    if _BUNDLED_REGISTRY.is_file():                  # (3) bundled in the wheel
        return json.loads(_BUNDLED_REGISTRY.read_text(encoding="utf-8"))

    remote = _load_remote_registry()                 # (4) published, fetched
    if remote is not None:
        return remote

    raise FileNotFoundError(
        "No dataset registry found. Looked for:\n"
        f"  - {_REGISTRY_PATH} (in-repo / mirror)\n"
        f"  - {_REGISTRY_DIR}/registry-*.json (split files)\n"
        f"  - {_BUNDLED_REGISTRY} (bundled in package)\n"
        f"  - {_REGISTRY_URL} (remote — unreachable or disabled)\n"
        "The registry ships inside the package — reinstall it "
        "(`python3 -m pip install --force-reinstall mt-eval-harness`) or check your "
        "network connection. Pass a corpus file instead with "
        "`--corpus <path>`; a source checkout can rebuild the registry with "
        "scripts/build_registry.py or point MT_EVAL_DATA_ROOT at it."
    )


# ---------------------------------------------------------------------------
# Eval pack dependency gate
# ---------------------------------------------------------------------------


def _registry_entry_is_sealed(entry: dict) -> bool:
    """The provider gate's verdict for a registered corpus: sealed (local-only,
    held-out/gold-standard, quarantined) means no outside service may see it."""
    from mt_eval_harness.transmission_policy import (
        MODE_SEALED, resolve_transmission_policy,
    )
    return resolve_transmission_policy(
        entry.get("id", ""), registry_entry=entry).mode == MODE_SEALED
#
# The eval pack gate prevents evaluation against a dataset whose target
# language requires tools that aren't installed. It reads requirements
# from the language card's `evalPack` field — no language-specific code.
#
# Adding eval pack support for a new language = editing ONE JSON file
# (the language card). The harness checks it generically.


def eval_standard_missing(target_code: str) -> dict | None:
    """The language card's eval-standard package, when its metrics are
    declared but the package is not installed; None otherwise.

    Returns ``{package, pip, metrics, missing_imports}`` — ``pip`` is the
    card's ``evalStandard.pip`` (None when the card names none). Data-driven:
    nothing here names a language or a package."""
    import importlib.util as _ilu
    from mt_eval_harness.language_cards import get_eval_metrics, get_eval_standard

    metrics = get_eval_metrics(target_code) or {}
    if not metrics:
        return None
    needed = sorted({str(d.get("module") or "").split(".")[0]
                     for d in metrics.values() if isinstance(d, dict)} - {""})
    missing = [m for m in needed if _ilu.find_spec(m) is None]
    if not missing:
        return None
    standard = get_eval_standard(target_code) or {}
    return {"package": standard.get("package") or ", ".join(missing),
            "pip": standard.get("pip"),
            "metrics": sorted(metrics),
            "missing_imports": missing}


#: The flag that scores a run without each kind of eval-pack piece (the run
#: card then marks those metrics not computed).
_SKIP_FST = "--skip-fst"
_SKIP_STANDARD = "--skip-eval-standard"

#: FST formats `mt-eval setup --lang <code>` downloads by itself
#: (plugins.fst_installer.install_fst). Any other pinned format is installed
#: by hand. The MCP server mirrors this list (harness-fst.js).
FST_AUTO_INSTALL_FORMATS = ("giellalt-nightly-apt", "legacy-zip",
                            "divvun-macos-pkg")

#: What a run without the FST loses — the same words on every surface.
FST_NOT_COMPUTED = "FST acceptance and morphology are marked not computed"


def _is_fst_piece(label: str) -> bool:
    """An eval-pack label for the FST lane: the analyzer or its runtime."""
    return label.startswith("FST ") or "(pyhfst)" in label


def fst_state(code: str | None) -> dict | None:
    """What THIS machine has of a language's FST lane — the one reading every
    status surface uses (``mt-eval setup --status``, the eval-pack lines, the
    run's advisory, the MCP overview and plan via the harness).

    Three surfaces used to disagree (synthetic school persona, Round 8):
    setup --status listed the pinned FSTs as "auto-download on first eval",
    the eval-pack lines said the run stops, and the MCP overview said the FST
    "downloads on the first evaluation". Nothing downloads by itself: the
    FST arrives only through `mt-eval setup --lang <code>`.

    Returns None when the harness pins no FST for the language. Otherwise::

        {code, name, format, auto_install, analyzer_installed,
         runtime_installed, ready, missing, setup_command, line}

    ``missing`` names the absent pieces in words ("the FST runtime
    (pyhfst)", "the Plains Cree FST analyzer"); ``setup_command`` is the
    command that installs what can be installed (the runtime always, the
    analyzer when its format is automatic); ``line`` is the one-sentence
    wording. Installs nothing; only looks.
    """
    if not code:
        return None
    from mt_eval_harness import language_cards as _lc
    info = _lc.get_fst_install_info(code)
    if info is None:
        return None
    from mt_eval_harness.plugins.fst_installer import is_fst_installed
    pin = _lc.get_fst_pin(code) or {}
    try:
        name = _lc.get_name(code) or pin.get("name") or code
    except Exception:  # noqa: BLE001 — a status line must not die on the index
        name = pin.get("name") or code
    fmt = info.get("format") or "unstated"
    auto = fmt in FST_AUTO_INSTALL_FORMATS
    analyzer = bool(is_fst_installed(code))
    try:
        __import__("pyhfst")
        runtime = True
    except ImportError:
        runtime = False
    missing = []
    if not runtime:
        missing.append("the FST runtime (pyhfst)")
    if not analyzer:
        missing.append(f"the {name} FST analyzer")
    setup = f"mt-eval setup --lang {code}"
    who = f"FST for {name} ({code})"
    if not missing:
        line = (f"{who}: installed here (analyzer + pyhfst runtime) — FST "
                f"acceptance is measured.")
    elif analyzer or auto:
        line = (f"{who}: not installed here — {' and '.join(missing)} "
                f"{'is' if len(missing) == 1 else 'are'} missing. Nothing "
                f"downloads unless you run `{setup}`; until then "
                f"{FST_NOT_COMPUTED}.")
    else:
        line = (f"{who}: not installed here — the analyzer has no automatic "
                f"install (format {fmt!r}: see the language card's FST "
                f"install notes)"
                + (f"; `{setup}` installs the pyhfst runtime" if not runtime
                   else "")
                + f". Nothing downloads by itself; until then "
                  f"{FST_NOT_COMPUTED}.")
    return {"code": code, "name": name, "format": fmt, "auto_install": auto,
            "analyzer_installed": analyzer, "runtime_installed": runtime,
            "ready": not missing, "missing": missing,
            "setup_command": setup if (auto or not runtime) else None,
            "line": line}


def eval_pack_status(dataset_entry: dict, *,
                     card_metrics_withheld: bool = False,
                     skip_fst: bool = False,
                     skip_eval_standard: bool = False) -> dict:
    """What the eval-pack gate finds for a dataset's target language.

    The ONE check behind both the real run's gate (_check_eval_pack, which
    stops the run on it) and ``mt-eval run --dry-run`` (which reports it and
    goes on — the dry run used to skip it, so a Cree pre-flight passed and
    the first confirmed run stopped on the missing FST runtime; synthetic
    user, Round 7). Installs nothing; only looks.

    Reads the target language from the dataset's ``language_pair.target``
    (the registry's ``language_resolution`` stamp first — Position 4 v2: it
    strips script subtags and follows retirements/variety pins, so packs
    engage for e.g. a cmn-Hans corpus), then the card's ``evalPack``
    (python packages, the FST) and its eval-standard package.

    Returns a dict:
      ``status``         "missing" (something is not installed), "ready", or
                         "not_needed" (no eval pack for this language);
      ``stops_run``      True when a missing piece stops a real run — any
                         piece but the FST lane. A missing FST analyzer or
                         pyhfst runtime is ADVISORY (Round 8: a Cree school
                         got no baseline at all when the run stopped on it,
                         while nmt-forge scored the same test set and marked
                         FST not computed): the run proceeds, FST acceptance
                         and morphology are marked not computed, and the
                         message names `mt-eval setup --lang <code>` and the
                         re-score (`mt-eval test <run log>`);
      ``advisory`` / ``blocking``  the missing labels split that way;
      ``fst``            fst_state() — what is installed of the FST lane;
      ``language`` / ``language_name`` / ``dataset_id``;
      ``required``       the pieces demanded (labels, e.g. "pyhfst>=1.4
                         (pyhfst)", "FST morphological analyzer (Plains Cree)");
      ``missing``        the demanded pieces not installed, same labels;
      ``setup_command``  the command that installs them ("mt-eval setup
                         --lang <code>"), None when none can;
      ``manual_fst``     the FST's install format when it cannot be
                         installed automatically, else None;
      ``skip_flags``     the flags that score without the missing pieces;
      ``left_out``       pieces not demanded because of a skip flag or a
                         local-only corpus, with why;
      ``optional_missing`` the card's eval-standard package when it is not
                         installed (``{package, pip, metrics,
                         missing_imports}``) — an optional add-on that never
                         blocks: its metrics are marked not computed.

    ``skip_fst`` (--skip-fst): the FST and its runtime are not demanded.
    ``skip_eval_standard`` (--skip-eval-standard): likewise for the card's
    eval-standard metrics and their dependencies.
    ``card_metrics_withheld``: the corpus is local-only/sealed, so the
    card's eval-standard metrics will not be loaded (plugin_discovery: they
    can look words up on an outside service) and their packages are not
    demanded — a local-only Cree run was blocked on spaCy for metrics it
    would never run (synthetic Cree-school persona, 2026-10-03). The
    harness's own FST lane still runs locally and keeps its requirement.

    Fully data-driven — the language card is the SSOT; nothing here names a
    language or a package.
    """
    resolution = dataset_entry.get("language_resolution") or {}
    lang_pair = dataset_entry.get("language_pair", {}) or {}
    target_code = ((resolution.get("target") or {}).get("resolved")
                   or lang_pair.get("target"))
    status: dict = {
        "status": "not_needed", "language": target_code or None,
        "language_name": None,
        "dataset_id": dataset_entry.get("id", "(this corpus)"),
        "required": [], "missing": [], "setup_command": None,
        "manual_fst": None, "skip_flags": [], "left_out": [],
        "optional_missing": None, "stops_run": False,
        "advisory": [], "blocking": [], "fst": None,
    }
    if not target_code:
        return status   # No target language declared — nothing to check

    from mt_eval_harness.language_cards import (
        get_eval_metrics, get_eval_pack, get_name,
    )
    lang_name = get_name(target_code) or target_code
    status["language_name"] = lang_name
    pack = get_eval_pack(target_code) or {}
    withhold_standard = card_metrics_withheld or skip_eval_standard
    fst = fst_state(target_code)
    status["fst"] = fst
    if not pack and not get_eval_metrics(target_code) and fst is None:
        return status   # this language declares no eval pack

    required, missing, left_out = [], [], []
    setup_needed = False
    # Why the eval-standard side is not demanded, when it is not.
    std_why = ("--skip-eval-standard" if skip_eval_standard else
               "local-only corpus (the eval-standard metrics can look words "
               "up on an outside service, so they are not loaded)")

    # Python dependencies declared in the eval pack
    declared = pack.get("pythonDeps", {}) or {}
    python_deps = declared
    if withhold_standard:
        python_deps = ({"pyhfst": declared.get("pyhfst", "pyhfst")}
                       if pack.get("requiresFst") else {})
        left_out += [f"{spec} ({name}) — {std_why}"
                     for name, spec in declared.items()
                     if name not in python_deps]
    elif pack:
        # A need only an UNINSTALLED optional add-on's metrics declare (e.g.
        # spaCy for LYSS-sem) is not demanded here — the same split `mt-eval
        # setup --lang` installs by, so the command this gate names actually
        # satisfies it (Round 3 school persona: setup pulled spaCy + a 33.5 MB
        # model for an add-on that was not installed). If the add-on is
        # installed later, its metrics check their own dependencies at load.
        from mt_eval_harness.setup_wizard import split_eval_pack
        python_deps = split_eval_pack(target_code, pack)["pythonDeps"]
    wants_fst = bool(pack.get("requiresFst")) or fst is not None
    if wants_fst and "pyhfst" not in python_deps:
        # a pinned FST needs its runtime whether or not the pack lists it
        python_deps = {**python_deps, "pyhfst": "pyhfst"}
    if skip_fst and "pyhfst" in python_deps:
        left_out.append(f"{python_deps['pyhfst']} (pyhfst) — {_SKIP_FST}")
        python_deps = {k: v for k, v in python_deps.items() if k != "pyhfst"}
    for import_name, pip_spec in python_deps.items():
        label = f"{pip_spec} ({import_name})"
        required.append(label)
        try:
            __import__(import_name)
        except ImportError:
            missing.append(label)
            setup_needed = True

    # FST files, if the pack requires them (or the harness pins one)
    if wants_fst:
        label = f"FST morphological analyzer ({lang_name})"
        if skip_fst:
            left_out.append(f"{label} — {_SKIP_FST}")
        else:
            required.append(label)
            from mt_eval_harness.plugins.fst_installer import is_fst_installed
            if not is_fst_installed(target_code):
                missing.append(label)
                from mt_eval_harness.language_cards import get_fst_install_info
                fmt = (get_fst_install_info(target_code) or {}).get("format")
                if fmt in ("giellalt-nightly-apt", "legacy-zip",
                           "divvun-macos-pkg"):
                    setup_needed = True
                else:
                    status["manual_fst"] = fmt or "none"

    # The card's eval-standard package (it provides the evalMetrics) is an
    # optional add-on: when it is not installed the run goes ahead without
    # its metrics (plugin discovery marks them not computed and names the
    # install command). It never blocks a run.
    if not withhold_standard:
        status["optional_missing"] = eval_standard_missing(target_code)
    elif get_eval_metrics(target_code):
        left_out.append("eval-standard metrics ("
                        + ", ".join(sorted(get_eval_metrics(target_code)))
                        + f") — {std_why}")

    advisory = [m for m in missing if _is_fst_piece(m)]
    blocking = [m for m in missing if not _is_fst_piece(m)]
    skip_flags = []
    if advisory:
        skip_flags.append(_SKIP_FST)
    if not withhold_standard and blocking:
        # Every demanded dependency but the FST runtime serves the card's
        # eval-standard metrics: --skip-eval-standard drops them.
        skip_flags.append(_SKIP_STANDARD)
    status.update(
        status="missing" if missing else "ready",
        required=required, missing=missing, left_out=left_out,
        setup_command=(f"mt-eval setup --lang {target_code}"
                       if setup_needed else None),
        skip_flags=skip_flags, advisory=advisory, blocking=blocking,
        stops_run=bool(blocking),
    )
    return status


def fst_advisory_message(status: dict) -> str:
    """The run's notice for a missing FST lane (the advisory half of
    eval_pack_status): it proceeds, what is marked not computed, the one
    install command, and how to add the metric afterwards WITHOUT
    re-translating. Empty when nothing of the FST lane is missing."""
    if not status.get("advisory"):
        return ""
    name, code = status["language_name"], status["language"]
    fst = status.get("fst") or {}
    how = status.get("setup_command") or fst.get("setup_command")
    manual = status.get("manual_fst")
    lines = [
        f"  ⚠ {name} ({code}): the run proceeds WITHOUT FST scoring — "
        f"{FST_NOT_COMPUTED} on its card.",
        f"    Not installed here: {', '.join(status['advisory'])}.",
    ]
    if how:
        lines.append(f"    Nothing downloads unless you run: {how}")
    if manual:
        lines.append(f"    (the {name} FST has no automatic install — format "
                     f"{manual!r}; see the language card's FST install notes)")
    lines.append("    Then `mt-eval test <run log>` re-scores this run with the "
                 "FST, without re-translating. (--skip-fst leaves it out "
                 "without this notice.)")
    return "\n".join(lines)


_SKIP_FLAG_HELP = {
    _SKIP_FST: "(no FST acceptance)",
    _SKIP_STANDARD: "(no eval-standard metrics)",
}


def eval_pack_required_message(status: dict) -> str:
    """The real run's refusal for a status whose pieces are missing — the
    "EVAL PACK REQUIRED" block (queue_runner reads its commands)."""
    lang_name, target_code = status["language_name"], status["language"]
    lines = [
        "",
        f"  EVAL PACK REQUIRED: {lang_name} ({target_code})",
        f"  Dataset '{status['dataset_id']}' targets {target_code}, which "
        f"needs evaluation tools that are not installed. `mt-eval run` "
        f"installs nothing by itself.",
        "",
        "  Missing:",
        *(f"    ✗ {m}" for m in (status.get("blocking") or status["missing"])),
        "",
        "  Install them (each command says what it installs):",
    ]
    if status["setup_command"]:
        lines.append(f"    {status['setup_command']}")
    if status["manual_fst"]:
        lines.append(f"    (the {lang_name} FST cannot be installed "
                     f"automatically — format {status['manual_fst']!r}; see "
                     f"the language card's FST install notes)")
    lines.append("")
    lines.append("  Or run without them — the run card marks them not "
                 "computed:")
    for flag in status["skip_flags"]:
        lines.append(f"    {flag:<21} {_SKIP_FLAG_HELP[flag]}")
    if status.get("advisory") and status.get("blocking"):
        lines.append("")
        lines.append(f"  Also not installed (these never stop a run — "
                     f"{FST_NOT_COMPUTED}): "
                     + ", ".join(status["advisory"]))
    lines.append("")
    return "\n".join(lines)


def _check_eval_pack(dataset_entry: dict, assume_yes: bool = False, *,
                     card_metrics_withheld: bool = False,
                     skip_fst: bool = False,
                     skip_eval_standard: bool = False) -> None:
    """Verify that eval pack dependencies for a dataset's target language
    are installed — and STOP, naming the exact commands, when they are not.

    The check is eval_pack_status (shared with the dry run). Nothing is
    installed here: installing packages is an explicit step — ``mt-eval
    setup --lang <code>``, which says what it installs, or the ``pip
    install`` the card names for its eval standard. ``mt-eval run`` used to
    pip-install them by itself under --yes / CI / MT_EVAL_AUTO_SETUP (a
    school run pip-installed pyhfst into the user's venv, seen only in a job
    log — synthetic school persona, Round 6). ``assume_yes`` is accepted for
    callers and ignored: it confirms the run, not package installs.

    A missing FST lane (the analyzer or its pyhfst runtime) does NOT stop
    the run (Round 8): it is printed as an advisory (fst_advisory_message)
    and the run is scored without it, FST marked not computed — what
    nmt-forge's export already did for the same test set.

    Raises:
        RuntimeError: the "EVAL PACK REQUIRED" message when a piece other
            than the FST lane is missing.
    """
    del assume_yes  # confirms the run, never a package install
    status = eval_pack_status(
        dataset_entry, card_metrics_withheld=card_metrics_withheld,
        skip_fst=skip_fst, skip_eval_standard=skip_eval_standard)
    standard = status["optional_missing"]
    if standard:
        from mt_eval_harness.setup_wizard import pip_install_hint
        hint = (pip_install_hint(standard["pip"]) if standard.get("pip")
                else f"the package providing {', '.join(standard['missing_imports'])}")
        print(f"  Note: {status['language_name']}'s eval-standard package "
              f"{standard['package']} is not installed — its metrics "
              f"({', '.join(standard['metrics'])}) will be marked not "
              f"computed. To add them: {hint}")
    if status["stops_run"]:
        raise RuntimeError(eval_pack_required_message(status))
    advisory = fst_advisory_message(status)
    if advisory:
        print(advisory)


#: The marker every dry-run eval-pack line starts with — a stable prefix
#: agents (the MCP server) look for. Never change it.
EVAL_PACK_MARKER = "EVAL PACK:"


def _pip_hint(spec: str) -> str:
    """setup_wizard.pip_install_hint, imported lazily (one wording)."""
    from mt_eval_harness.setup_wizard import pip_install_hint
    return pip_install_hint(spec)


def merge_eval_pack_statuses(statuses: list[dict]) -> dict | None:
    """One eval-pack verdict from the gate checks a run makes (the registry
    entry's and the target language's — usually the same language)."""
    if not statuses:
        return None
    if len(statuses) == 1:
        return dict(statuses[0])
    order = {"missing": 2, "ready": 1, "not_needed": 0}
    merged = dict(max(statuses, key=lambda s: order[s["status"]]))
    for key in ("required", "missing", "skip_flags", "left_out",
                "advisory", "blocking"):
        merged[key] = list(dict.fromkeys(x for s in statuses
                                         for x in s.get(key) or []))
    merged["stops_run"] = bool(merged["blocking"])
    merged["fst"] = next((s["fst"] for s in statuses if s.get("fst")), None)
    cmds = list(dict.fromkeys(s["setup_command"] for s in statuses
                              if s["setup_command"]))
    merged["setup_command"] = " && ".join(cmds) or None
    merged["manual_fst"] = next((s["manual_fst"] for s in statuses
                                 if s["manual_fst"]), None)
    merged["optional_missing"] = next((s["optional_missing"] for s in statuses
                                       if s["optional_missing"]), None)
    merged["status"] = ("missing" if merged["missing"] else merged["status"])
    return merged


def eval_pack_json(status: dict | None, *, blocks_run: bool) -> dict:
    """The dry run's machine-readable ``eval_pack`` object:
    ``{status, missing, setup_command}`` (the contract agents read) plus
    the language, the skip flags, what is left out, the optional add-on,
    and whether the real run would stop on what is missing."""
    s = status or {"status": "not_needed", "language": None, "missing": [],
                   "setup_command": None, "skip_flags": [], "left_out": [],
                   "required": [], "optional_missing": None}
    opt = s.get("optional_missing")
    return {
        "status": s["status"],
        "missing": list(s["missing"]),
        "setup_command": s["setup_command"],
        "language": s.get("language") or None,
        "required": list(s.get("required") or []),
        "skip_flags": list(s.get("skip_flags") or []),
        "left_out": list(s.get("left_out") or []),
        "optional_missing": ({
            "package": opt["package"], "metrics": opt["metrics"],
            "install_command": (_pip_hint(opt["pip"])
                                if opt.get("pip") else None),
        } if opt else None),
        "blocks_run": bool(blocks_run and s.get("stops_run",
                                                 s["status"] == "missing")),
        "advisory": list(s.get("advisory") or []),
        "fst": ({k: (s.get("fst") or {}).get(k) for k in (
            "analyzer_installed", "runtime_installed", "auto_install",
            "setup_command", "line")} if s.get("fst") else None),
    }


def eval_pack_lines(status: dict | None, *, blocks_run: bool,
                    language_label: str = "") -> list[str]:
    """The dry run's report of the eval-pack check, one fact per line, each
    starting with EVAL_PACK_MARKER (flush left — agents match the prefix):

      EVAL PACK: missing — <pieces>; set it up with: <command>; or pass
                 <flags> to score without them (marked not computed)
      EVAL PACK: ready (<pieces>)
      EVAL PACK: none needed for <language>

    then, when they apply, what the real run does with a missing pack, what
    a skip flag or a local-only corpus leaves out, and the optional
    eval-standard add-on that is not installed."""
    m = EVAL_PACK_MARKER
    s = status or {"status": "not_needed", "language": None,
                   "language_name": None}
    code = s.get("language")
    own = s.get("language_name")
    # A code with no card has no card name: the label the run was given
    # (--target-lang) names it, not the bare code.
    name = ((own if own and own != code else None) or language_label or own
            or "this language")
    who = f"{name} ({code})" if code and code != name else name
    if s["status"] == "not_needed":
        from mt_eval_harness.language_cards import is_private_use
        why = ("" if code and not is_private_use(code) else
               " — an ISO 639-3 private-use code (qaa–qtz): no language "
               "card exists for it, by design" if code else
               " (no language card resolved for the target)")
        return [f"{m} none needed for {who}{why}"]
    lines = []
    if s["status"] == "missing":
        how = s["setup_command"] or ""
        if s.get("manual_fst"):
            manual = (f"the {name} FST has no automatic install (format "
                      f"{s['manual_fst']!r}) — see the language card's FST "
                      f"install notes")
            how = f"{how} (and {manual})" if how else manual
        stops = s.get("stops_run", True)
        if stops:
            flags = " or ".join(s["skip_flags"])
            lines.append(f"{m} missing — {', '.join(s['missing'])}; set it up "
                         f"with: {how}"
                         + (f"; or pass {flags} to score without them "
                            f"(marked not computed)" if flags else ""))
            lines.append(f"{m} " + (
                "the real run stops on this before translating anything"
                + (f" (the FST pieces alone would not: {FST_NOT_COMPUTED})"
                   if s.get("advisory") else "") + "."
                if blocks_run else
                "the real run is not stopped by it (the target language is "
                "known only from the corpus) — it scores without these "
                "metrics."))
        else:
            # Only the FST lane is missing: advisory, the run proceeds.
            lines.append(f"{m} missing — {', '.join(s['missing'])}; nothing "
                         f"downloads unless you run: {how}"
                         f" (--skip-fst leaves it out without this notice)")
            lines.append(f"{m} the real run is not stopped by it — it "
                         f"proceeds and {FST_NOT_COMPUTED}; after installing, "
                         f"`mt-eval test <run log>` re-scores it without "
                         f"re-translating.")
    else:
        pieces = ", ".join(s["required"]) or "nothing to install"
        lines.append(f"{m} ready ({pieces})")
    # What a skip flag or a local-only corpus leaves out, one line per reason.
    by_why: dict[str, list[str]] = {}
    for item in s.get("left_out") or []:
        piece, _, why = item.rpartition(" — ")
        by_why.setdefault(why or "left out", []).append(piece or item)
    for why, pieces in by_why.items():
        lines.append(f"{m} left out ({why}); the metrics they serve are "
                     f"marked not computed: {', '.join(pieces)}")
    opt = s.get("optional_missing")
    if opt:
        add = (_pip_hint(opt["pip"]) if opt.get("pip")
               else f"the package providing {', '.join(opt['missing_imports'])}")
        lines.append(f"{m} optional — {name}'s eval-standard package "
                     f"{opt['package']} is not installed; its metrics "
                     f"({', '.join(opt['metrics'])}) will be marked not "
                     f"computed. Add them with: {add}")
    return lines


def canonical_registry_id(id_or_path: str,
                          registry_path: Path | None = None) -> str | None:
    """Return the canonical registry dataset id for a bare id or alias.

    Returns None when ``id_or_path`` is not a registered dataset (e.g. it is a
    filesystem path, or a fetch-only corpora card with no registry entry), or
    when the registry can't be read.

    Used at config-validation time to record the REGISTERED id (e.g.
    ``eval-eng-ilo-tatoeba-dev-v1``) as the run's ``dataset_id``, so a published
    run card's ``dataset_id`` joins a real ``datasets`` row — instead of the
    built corpus file's self-describing ``corpus_id`` (e.g. ``tatoeba-eng-ilo-dev``),
    which matches no registered dataset.
    """
    try:
        registry = load_registry(registry_path)
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    for d in registry.get("datasets", []):
        if d.get("id") == id_or_path or id_or_path in d.get("aliases", []):
            return d.get("id")
    return None


def resolve_dataset(id_or_path: str, registry_path: Path | None = None,
                    assume_yes: bool = False, skip_eval_pack: bool = False,
                    skip_fst: bool = False,
                    skip_eval_standard: bool = False,
                    eval_pack_report: list | None = None) -> Path:
    """Resolve a dataset identifier to a local file path.

    Accepts either:
        - A filesystem path (absolute or relative) → returned directly
        - A registry dataset ID (e.g. 'edtekla-dev-v1') → looked up in
          the registry. Resolution chain:
            1. local_path → resolved relative to monorepo root
            2. url → downloaded and cached
            3. Neither → error with instructions

    Args:
        id_or_path: Filesystem path or registry dataset ID.
        registry_path: Optional override for the registry file location.
        eval_pack_report: With ``skip_eval_pack`` (a dry run), the gate's
            verdict (eval_pack_status) for the matched dataset is appended
            here instead of being enforced — the dry run reports what the
            real run would stop on.

    Returns:
        Path to the local dataset JSON file.

    Raises:
        FileNotFoundError: If the path doesn't exist and the ID isn't in the registry.
        ValueError: If the registry entry has no download URL or local path.
    """
    # First, check if it's a path that exists
    candidate = Path(id_or_path)
    if candidate.exists():
        return candidate

    # Not a local path — try the registry
    try:
        registry = load_registry(registry_path)
    except FileNotFoundError:
        raise FileNotFoundError(
            f"'{id_or_path}' is not a local file and no dataset registry "
            f"was found. Provide a valid file path or install the registry."
        )

    datasets = registry.get("datasets", [])

    # Match by ID or alias
    match = next((d for d in datasets if d["id"] == id_or_path), None)
    if not match:
        # Check aliases — datasets can declare alternative names
        # (e.g., "edtekla-full" → "edtekla-textbook")
        match = next(
            (d for d in datasets
             if id_or_path in d.get("aliases", [])),
            None,
        )

    if not match:
        # Branch the message on what the user clearly meant. Path-shaped input
        # (has a path separator, or a corpus-file extension like .json/.jsonl/
        # .tsv/.csv) is a file they expected to exist — surface a plain
        # "file not found" instead of burying it under 10 dataset IDs +
        # "(and N more)". Only id-shaped input gets registry suggestions.
        _looks_like_path = (
            os.sep in id_or_path
            or (os.altsep and os.altsep in id_or_path)
            or Path(id_or_path).suffix.lower() in {".json", ".jsonl", ".tsv", ".csv"}
        )
        if _looks_like_path:
            raise FileNotFoundError(
                f"Corpus file not found: {id_or_path}. "
                f"Check the path, or pass a registered dataset ID "
                f"(see: mt-eval list datasets)."
            )

        # No exact match or alias — suggest closest with fuzzy matching
        import difflib
        all_ids = [d["id"] for d in datasets]
        # Also include aliases for matching
        all_searchable = list(all_ids)
        for d in datasets:
            all_searchable.extend(d.get("aliases", []))
        close = difflib.get_close_matches(id_or_path, all_searchable, n=5, cutoff=0.4)
        if close:
            suggestions = ", ".join(close)
            raise FileNotFoundError(
                f"Dataset '{id_or_path}' not found in registry. "
                f"Did you mean: {suggestions}? "
                f"Or provide a local file path."
            )
        # No close match — show a truncated list
        shown = all_ids[:10]
        suffix = f" (and {len(all_ids) - 10} more)" if len(all_ids) > 10 else ""
        raise FileNotFoundError(
            f"Dataset '{id_or_path}' not found in registry. "
            f"Available: {', '.join(shown)}{suffix}. "
            f"Or provide a local file path."
        )

    # --- Eval pack dependency gate ---
    # Datasets can declare `eval_pack` (e.g., "crk") to require specific
    # evaluation dependencies. This ensures nobody runs CRK evaluation
    # without the FST, linter, and other required tools installed.
    # A dry run is a config+corpus pre-flight that does NO scoring, so it must
    # not require (or auto-install AGPL) scoring tools — skip the gate there.
    if not skip_eval_pack:
        _check_eval_pack(match, assume_yes=assume_yes,
                         card_metrics_withheld=_registry_entry_is_sealed(match),
                         skip_fst=skip_fst,
                         skip_eval_standard=skip_eval_standard)
    elif eval_pack_report is not None:
        eval_pack_report.append(eval_pack_status(
            match, card_metrics_withheld=_registry_entry_is_sealed(match),
            skip_fst=skip_fst, skip_eval_standard=skip_eval_standard))

    # Check for a local_path. In an in-repo checkout this is relative to the
    # monorepo root, but under `pip install` there is no monorepo (the package
    # lives in site-packages), so the single monorepo-root guess (B4) breaks.
    # Try several bases plus an env override, then fall through to
    # fetch-from-source — never hard-fail a pip user who just lacks the file.
    local_path = match.get("local_path")
    if local_path:
        candidate_bases = [
            _PACKAGE_DIR.parent.parent,   # monorepo root (in-repo checkout)
            _PACKAGE_DIR.parent,          # arena/ (installed-package layouts)
            _REGISTRY_DIR.parent,         # arena/ via the registry location
            Path.cwd(),                   # the caller's working directory
        ]
        env_root = os.environ.get("MT_EVAL_DATA_ROOT")
        if env_root:
            candidate_bases.insert(0, Path(env_root))
        for base in candidate_bases:
            resolved = base / local_path
            if resolved.exists():
                return resolved
        # Declared but not found under any base — fall through to URL/fetch.
        logger.debug(
            "local_path '%s' for dataset '%s' not found under any known base "
            "(%s); falling through to fetch-from-source",
            local_path, id_or_path,
            ", ".join(str(b) for b in candidate_bases),
        )

    url = match.get("url")
    if not url:
        # No directly downloadable URL. Before declaring the dataset
        # unreachable, try the corpora-card fetch-from-source path: cards
        # in cli/shared/corpora-cards/ can rebuild a corpus from its
        # upstream repo into the gitignored cache (license consent via
        # --yes / CI). This is how registry-ID runs work on a cold machine
        # where nothing is materialized locally.
        from mt_eval_harness.corpus_fetch import try_fetch_missing_corpus
        for fetch_key in (local_path, match.get("path"), match.get("id")):
            if not fetch_key:
                continue
            built = try_fetch_missing_corpus(fetch_key, assume_yes=assume_yes)
            if built is not None:
                return built

        # Private dataset — no URL and no fetchable corpora card
        access = match.get("access", "unknown")
        notes = match.get("notes", "")
        hint = f"\n  local_path: {local_path}" if local_path else ""
        raise ValueError(
            f"Dataset '{id_or_path}' is {access} and has no download URL.{hint}\n"
            f"  {notes}\n"
            f"  Provide the corpus with --corpus <path>, or set MT_EVAL_DATA_ROOT "
            f"to the directory containing '{local_path or id_or_path}'."
        )

    # URL is set — download and cache
    cache_dir = _CACHE_ROOT / "datasets"
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Use sha256 of URL as cache filename
    url_hash = hashlib.sha256(url.encode()).hexdigest()[:16]
    cached = cache_dir / f"{match['id']}_{url_hash}.json"

    if cached.exists():
        return cached

    # Download synchronously (simple, no async needed for a single file)
    import urllib.request
    print(f"  📥 Downloading dataset '{match['id']}' from {url}...")
    urllib.request.urlretrieve(url, cached)

    # Verify sha256 if provided
    expected_hash = match.get("sha256")
    if expected_hash:
        actual_hash = hashlib.sha256(cached.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            cached.unlink()
            raise ValueError(
                f"SHA-256 mismatch for '{match['id']}':\n"
                f"  Expected: {expected_hash}\n"
                f"  Got:      {actual_hash}\n"
                f"  The cached file has been deleted. Try again or report this."
            )

    print(f"  📦 Cached to {cached}")
    return cached


def format_registry_table(registry_path: Path | None = None) -> str:
    """Format the dataset registry as a human-readable table (all rows).

    Thin wrapper kept for existing callers; the listing itself lives in
    ``corpora_browse`` (the one SSOT for registry → display), so this prints
    the same honest availability vocabulary as ``mt-eval list datasets``.
    The old implementation derived availability from ``local_path``/``url``,
    which no registry entry sets, and so labelled every public corpus
    "(blank) = private".
    """
    from mt_eval_harness import corpora_browse  # lazy: corpora_browse imports config

    infos, hidden = corpora_browse.list_all_corpora(registry_path)
    return corpora_browse.format_datasets_table(
        infos, total=len(infos), hidden_quarantined=hidden, limit=None)


# ---------------------------------------------------------------------------
# Method card — author-provided method description
# ---------------------------------------------------------------------------

# Valid method classes (must match the schema in docs/method-card-spec.md)
VALID_METHOD_CLASSES = frozenset({
    "raw-llm", "coached-llm", "pipeline", "custom-plugin", "api", "human",
})

# Valid translation paradigms — the MT *paradigm* axis: how a method works at
# the algorithmic level. This is a THIRD, independent axis, orthogonal to both
# method class (how it translates: raw-llm/pipeline/api/…) and dependency class
# (what it needs: S/O/A1/A2/X). It is what makes "rule-based vs neural vs LLM" a
# first-class, comparable dimension: a rule-based Apertium system and Google
# Translate both land in pipeline/api on the class axis, but separate cleanly
# here as rule-based vs neural-nmt.
#
# Optional on a method card; absent → DEFAULT_PARADIGM ("unknown"), so older
# cards keep loading (the axis is additive, never a hard fail).
#
# CANONICAL & LOCKED (by design). This is the supported vocabulary.
# Enforcement is app-side (here), not a DB CHECK — so ADDING a paradigm later
# is a one-line edit with no migration; only renaming/removing a value once
# cards rely on it is costly. Canonical reference: the Paradigms table in the
# Method Interface spec (cli/website/docs/network/specifications/methods.md).
VALID_PARADIGMS = frozenset({
    "rule-based", "statistical", "neural-nmt", "llm", "hybrid", "human",
    "unknown",
})

DEFAULT_PARADIGM = "unknown"


# ---------------------------------------------------------------------------
# The API provider a run RECORDS — what actually carried the text
# ---------------------------------------------------------------------------

#: The provider recorded for a method-plugin run (``--method <dir>``) whose
#: transport the harness cannot see: the plugin made its own calls, so the
#: honest label names the plugin lane, never the harness's default LLM proxy.
METHOD_PLUGIN_PROVIDER = "method-plugin"
#: The provider recorded for a plugin run whose operator attested, with
#: ``--attest-local-transport``, that the plugin's transport is fully local
#: (the same attestation the transmission gate accepts for sealed corpora).
LOCAL_PROVIDER = "local"


#: The label a run's coaching carries when it was typed inline (--coaching).
INLINE_COACHING_LABEL = "inline coaching"


def coaching_label(config) -> str | None:
    """How a published card names a run's coaching — never a local path.

    ``config`` is a RunConfig or its ``to_dict()``. The explicit
    ``coaching_label`` wins ("inline coaching" for --coaching text); else the
    coaching file's name without its directory (a path names the user's
    machine: /Users/<name>/…, or a temp file that exists nowhere else); None
    when the run had no coaching.
    """
    def _get(key):
        return (config.get(key) if isinstance(config, dict)
                else getattr(config, key, None))

    label = str(_get("coaching_label") or "").strip()
    if label:
        return label
    path = _get("coaching_file") or _get("custom_prompt_path")
    return Path(str(path)).name if path else None


def recorded_api_provider(config) -> str | None:
    """The API provider a run records: who carried the text, not a default.

    ``config`` is a RunConfig or its ``to_dict()``. Before 2026-10-03 every
    run recorded ``config.provider``, which stays at its default
    ("openrouter") when the harness's own provider is never built — so a
    fully local method plugin calling a model on 127.0.0.1 was published as
    ``api_provider: "openrouter"``, inside its fingerprint too (synthetic
    researcher, Round 4). Now:

    * a self-contained MT engine (``--method google-translate``) records the
      engine id — the engine is the provider;
    * a method plugin (``--method <dir>``) records ``local`` when its
      operator attested a fully local transport (``--attest-local-transport``),
      else ``method-plugin`` — the plugin made its own calls, through
      whatever transport it chose;
    * every other run records ``config.provider`` (openrouter, openai,
      anthropic, gemini, local).

    The runner writes this value into the run log's config, publish and
    ``scripts/lint_run_reports.py`` derive it the same way, so a run log
    written before the fix publishes with the honest value as well.
    """
    def _get(key, default=None):
        if isinstance(config, dict):
            return config.get(key, default)
        return getattr(config, key, default)

    mt_method = str(_get("mt_method") or "").strip()
    if mt_method:
        return mt_method
    if str(_get("method_path") or "").strip():
        return (LOCAL_PROVIDER if _get("attest_local_transport")
                else METHOD_PLUGIN_PROVIDER)
    return _get("provider")


def load_method_card(path: str | Path) -> dict:
    """Load and validate a method card JSON file.

    Args:
        path: Path to the method card JSON file.

    Returns:
        Validated method card dict.

    Raises:
        FileNotFoundError: If the file doesn't exist.
        ValueError: If required fields are missing or invalid.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Method card not found: {path}")

    card = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_method_card(card)
    if errors:
        raise ValueError(
            f"Invalid method card ({path}):\n" +
            "\n".join(f"  - {e}" for e in errors)
        )

    # paradigm is optional and orthogonal to class. Default an absent paradigm
    # to "unknown" (warn, don't fail) so pre-paradigm cards keep loading — the
    # axis is additive. See VALID_PARADIGMS.
    if not card.get("paradigm"):
        card["paradigm"] = DEFAULT_PARADIGM
        logger.warning(
            "Method card '%s' declares no 'paradigm'; defaulting to '%s'. "
            "Set one of {%s} to place it on the paradigm axis "
            "(rule-based vs neural vs llm) on the leaderboard.",
            card.get("method_id") or card.get("name") or path,
            DEFAULT_PARADIGM,
            ", ".join(sorted(VALID_PARADIGMS)),
        )
    return card


def validate_method_card(card: dict) -> list[str]:
    """Validate a method card dict against the schema.

    Args:
        card: Method card dictionary to validate.

    Returns:
        List of error messages (empty if valid).
    """
    errors = []

    # Required fields
    for required in ("method_id", "name", "class"):
        if required not in card:
            errors.append(f"Missing required field: '{required}'")

    # method_id format
    method_id = card.get("method_id", "")
    if method_id:
        import re
        if not re.match(r"^[a-z0-9][a-z0-9-]*$", method_id):
            errors.append(
                f"method_id '{method_id}' must be kebab-case "
                f"(lowercase alphanumeric + hyphens, starting with a letter or digit)"
            )

    # class enum
    method_class = card.get("class", "")
    if method_class and method_class not in VALID_METHOD_CLASSES:
        errors.append(
            f"Invalid class '{method_class}'. "
            f"Must be one of: {', '.join(sorted(VALID_METHOD_CLASSES))}"
        )

    # paradigm enum (optional — orthogonal to class). Only validated when
    # present; an absent paradigm is not an error (load_method_card defaults
    # it to DEFAULT_PARADIGM). Mirrors the class check above.
    paradigm = card.get("paradigm", "")
    if paradigm and paradigm not in VALID_PARADIGMS:
        errors.append(
            f"Invalid paradigm '{paradigm}'. "
            f"Must be one of: {', '.join(sorted(VALID_PARADIGMS))}"
        )

    # Type checks for optional fields
    if "tools_used" in card and not isinstance(card["tools_used"], list):
        errors.append("'tools_used' must be an array of strings")

    if "supported_pairs" in card and not isinstance(card["supported_pairs"], list):
        errors.append("'supported_pairs' must be an array of strings")

    for bool_field in ("open_source", "prompt_published"):
        if bool_field in card and not isinstance(card[bool_field], bool):
            errors.append(f"'{bool_field}' must be a boolean")

    # Contest declarations (contract C2). A card may carry the entrant's
    # constraints block and the public release URL of the method; when it does,
    # they are validated by the SAME rules the bundle manifests are, so a
    # malformed declaration cannot reach the leaderboard by the card door.
    # Imported here (not at module scope) because config is imported by nearly
    # everything and contest_declarations lazily reaches back into
    # model_runner for the Lane A cross-check.
    from mt_eval_harness.contest_declarations import (
        constraints_block_findings,
        url_problem,
    )

    if "constraints" in card:
        errors.extend(f"'constraints': {p['detail']}"
                      for p in constraints_block_findings(card["constraints"]))

    if "open_source_url" in card:
        problem = url_problem(card["open_source_url"])
        if problem:
            errors.append(f"'open_source_url' {problem}")

    return errors


# ===========================================================================
# HARNESS_DEFAULTS — Single source of truth for all default values.
#
# Change a default here and it propagates to RunConfig, CLI, docs, and
# scripts. No need to hunt across files. Agents: USE THESE, don't
# override them unless you have a specific reason.
# ===========================================================================

# Batching: entries per API call. 25 is proven reliable across all frontier
# models. Cuts API calls by 25×. Tool-calling auto-overrides to 1.
DEFAULT_BATCH_SIZE = 25

# Max tokens: generous headroom prevents truncation. Translation outputs
# are short (1-30 words typically), so unused tokens cost nothing.
# Set high to eliminate any risk of null/truncated output.
DEFAULT_MAX_TOKENS = 32768

# Concurrency: parallel batch calls within a single model run.
# Bounded by asyncio.Semaphore. 8 is safe for all providers.
# For multi-model parallelism, use execute_multi_run() instead.
DEFAULT_CONCURRENCY = 8

# Caching: file-backed, keyed on model + prompt + temperature + lang pair.
# Prevents re-calling the API for already-translated entries.
# There is almost never a reason to turn this off.
DEFAULT_CACHE_ENABLED = True
DEFAULT_CACHE_DIR = "eval/cache/harness"

# Temperature: 0 for deterministic output. Recorded in run cards.
DEFAULT_TEMPERATURE = 0.0

# Output directory for RunLog JSON files.
DEFAULT_OUTPUT_DIR = "eval/logs/harness"

# Tool-calling safety cap: max rounds per entry before giving up.
DEFAULT_MAX_TOOL_ROUNDS = 8


# ---------------------------------------------------------------------------
# Exact model slugs only — no aliasing (founder ruling 2026-10-05)
# ---------------------------------------------------------------------------
# "slugs should be specific, NOT ALIASES — for all models, all slugs, no
# aliasing." Every model is named by its exact provider slug
# (vendor/model on OpenRouter, a provider's own exact name direct). Nothing
# resolves a short name, and nothing guesses a vendor for a bare name (the
# fuzzy "gpt-5.5" → "openai/gpt-5.5" matcher that lived here is gone too).
#
# shared/retired-model-aliases.json lists the short names the harness and the
# CLI USED to accept. It is read ONLY so a refusal can name the exact slug the
# old name stood for — never to map a name to a model. The package carries its
# own copy (data/retired-model-aliases.json, parity-tested).

#: Where to look the models up — said in every refusal.
MODEL_LIST_HINT = ("List models: https://openrouter.ai/models "
                   "(OpenRouter slugs), or `mt-eval list models --live`.")


def _load_retired_model_aliases() -> dict[str, str]:
    """Retired short name → the exact slug it used to stand for.

    Read from the package's own copy (mt_eval_harness/data/
    retired-model-aliases.json, held to shared/ by tests/test_model_defaults.py)
    — installed or in the monorepo alike. A missing file is a broken install:
    fail loud (a hand-kept mirror here was one more copy to drift).
    """
    from importlib import resources
    text = (resources.files("mt_eval_harness") / "data" / "retired-model-aliases.json").read_text(encoding="utf-8")
    return dict(json.loads(text).get("retired") or {})


RETIRED_MODEL_ALIASES: dict[str, str] = _load_retired_model_aliases()


def is_floating_model_id(name: str) -> bool:
    """True for an id that names whatever model a provider points it at
    today — OpenRouter's ``~vendor/…`` router ids and any ``…-latest`` /
    ``…:latest`` name — so a run could not say which model translated."""
    v = (name or "").strip()
    return v.startswith("~") or bool(re.search(r"[-:]latest$", v, re.I))


def exact_model_refusal(name: str, *, openrouter: bool = False) -> str | None:
    """The refusal for a model that is not an exact slug, or None when it is.

    Refused: a retired alias (naming the slug it used to stand for), a
    floating id, and — on OpenRouter (``openrouter=True``) — a bare name with
    no ``vendor/`` part, which OpenRouter has no model for and which the
    harness no longer guesses a vendor for.
    """
    v = (name or "").strip()
    if not v:
        return None
    if v in RETIRED_MODEL_ALIASES:
        return (f"'{v}' is not a model id — the harness takes exact model "
                f"slugs only, no aliases. Did you mean "
                f"{RETIRED_MODEL_ALIASES[v]} (what '{v}' used to stand for)? "
                f"{MODEL_LIST_HINT}")
    if is_floating_model_id(v):
        return (f"'{v}' is a floating model id — it names whatever model the "
                "provider points it at today, so a run could not say which "
                "model translated. The harness takes exact model slugs only: "
                f"name the model itself (e.g. {DEFAULT_MODEL}, the default). "
                f"{MODEL_LIST_HINT}")
    if openrouter and "/" not in v:
        return (f"'{v}' is not an OpenRouter model id — OpenRouter ids are "
                f"<vendor>/<model> (e.g. {DEFAULT_MODEL}), written out in "
                f"full; the harness does not guess a vendor. {MODEL_LIST_HINT}")
    return None


#: The harness's default model — an exact OpenRouter slug, never an alias.
#: Written once, in shared/model-defaults.json (role "harness").
from mt_eval_harness.model_defaults import default_model as _default_model  # noqa: E402
DEFAULT_MODEL = _default_model("harness")

# Models that reject temperature=0 (require 0.01 minimum)
NEEDS_NONZERO_TEMP: set[str] = {
    "anthropic/claude-opus-4.7",
    "anthropic/claude-opus-4.6",
    "anthropic/claude-opus-4.5",
    "anthropic/claude-opus-4.1",
    "anthropic/claude-opus-4",
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-sonnet-4",
    "deepseek/deepseek-v4-pro",
    "deepseek/deepseek-r1",
    "deepseek/deepseek-r1-0528",
}


# ---------------------------------------------------------------------------
# Plugin protocol — any translation method implements this
# ---------------------------------------------------------------------------

@runtime_checkable
class TranslationMethod(Protocol):
    """Protocol for pluggable translation methods.

    A method is a black box: source text in, translation out. The harness
    doesn't care what happens inside — it scores the output. Methods can be:
        - A custom multi-stage pipeline (decomp-recomp, backtranslation)
        - A fine-tuned model endpoint
        - A traditional MT system (Moses, Apertium)
        - A commercial API wrapper (Google Translate, DeepL)
        - Anything that produces translations

    The method receives a batch of entries (even if batch_size=1)
    and returns one result dict per entry.

    Why a protocol instead of a base class:
        Structural typing — existing pipelines don't need to inherit
        from anything. If it has the right method signature, it works.
    """

    @property
    def name(self) -> str:
        """Human-readable method name for run IDs and logs."""
        ...

    def method_card(self) -> dict | None:
        """Return method metadata for provenance tracking.

        The method card is embedded in the RunLog and published run card
        so results can be attributed to a specific method configuration.

        Returns None if the method doesn't provide a card (e.g., the
        built-in default LLM method — its provenance is captured via
        model, coaching prompt, temperature, etc.).

        Typical fields:
            name, method_id, class, author, description,
            tools_used, supported_pairs
        """
        ...

    async def translate(
        self,
        entries: list[dict],
        config: "RunConfig",
    ) -> list[dict]:
        """Translate a batch of entries.

        Args:
            entries: List of dicts with at least the source field and 'id' keys.
                     (The source text key is determined by config.source_field,
                      which defaults to 'source'.)
            config: The full run configuration for context.

        Returns:
            List of result dicts, one per entry, each containing at minimum:
                - id: int — entry ID from the corpus
                - predicted: str — the translated text
                - latency_s: float — time taken in seconds
                - usage: dict — token usage (prompt_tokens, completion_tokens)
                - error: str | None — error message if failed
                - tool_calls: list[dict] — tool call log (empty if no tools)
                - tool_call_count: int — total tool calls made
                - metadata: dict — any process-specific metadata
        """
        ...


# ---------------------------------------------------------------------------
# Run configuration
# ---------------------------------------------------------------------------

def _harness_version() -> str:
    from mt_eval_harness import __version__
    return __version__


def target_card_scripts(config) -> tuple[list[str], str]:
    """The ISO 15924 scripts the run's target-language card lists, and a
    label for the language — ``([], label)`` when no card resolves or it
    lists none. Read through the card adapter (language_cards.get_card,
    which normalizes the card), never a bare JSON read."""
    code = (getattr(config, "target_lang_code", "") or
            getattr(config, "target_code", "") or "")
    name = getattr(config, "target_lang", "") or ""
    try:
        from mt_eval_harness import language_cards as _lc
        if not code and name:
            code = _lc.resolve_name(name) or ""
        card = _lc.get_card(code) if code else None
    except Exception:  # noqa: BLE001 — no card index = no card facts
        card = None
    label = name or code or "target"
    if not isinstance(card, dict):
        return [], label
    out = _lc.script_codes(card)
    return out, (f"{name} ({code})" if name and code and name != code
                 else label)


@dataclass
class RunConfig:
    """Complete configuration for a single harness run.

    Every knob that affects execution is captured here. The full config
    is serialized into the RunLog so any result can be reproduced exactly.

    ┌──────────────────────────────────────────────────────────────┐
    │  DEFAULTS ARE INTENTIONALLY AGGRESSIVE                      │
    │                                                              │
    │  • batch_size  = 25     → 25× fewer API calls               │
    │  • max_tokens  = 32768  → zero truncation risk               │
    │  • concurrency = 8      → parallel batches per model         │
    │  • cache       = on     → no redundant API calls             │
    │                                                              │
    │  These defaults come from HARNESS_DEFAULTS constants above.  │
    │  Do NOT lower them without a specific reason.                │
    │                                                              │
    │  For multi-model runs, use execute_multi_run() to run all    │
    │  models in parallel — each gets its own session/semaphore.   │
    │  DO NOT loop sequentially over execute_run().                │
    └──────────────────────────────────────────────────────────────┘
    """

    # --- Dataset selection ---
    # "all" = full corpus, or segment name, or "0-61" range
    dataset: str = "all"
    # Human-readable dataset ID for run cards and the leaderboard.
    # Auto-populated from corpus metadata if not set explicitly.
    dataset_id: str = ""
    # Explicit entry IDs override dataset if provided
    entry_ids: list[int] | None = None

    # --- Corpus ---
    # Path to the corpus file. Supports multiple formats:
    #   .json  — Harness JSON (wrapped or flat list)
    #   .jsonl — One JSON object per line (HuggingFace style)
    #   .tsv   — Tab-separated (source<tab>reference per line)
    # For parallel text files, use source_file + reference_file instead.
    corpus_path: str | None = None

    # --- Parallel text mode ---
    # For FLORES+, WMT, NTREX, and other standard MT corpora that ship
    # as aligned text files (one sentence per line).
    source_file: str | None = None     # --source-file path
    reference_file: str | None = None  # --reference-file path

    # --- Source / target field names ---
    # These map to the JSON keys in your corpus file.
    source_field: str = "source"       # The field name for source text in corpus
    target_field: str = "reference"    # The field name for gold-standard translation

    # --- Language pair ---
    # Human-readable language names used in prompts and run cards.
    # The naive prompt interpolates target_lang to tell the model WHAT
    # language to translate into. Without this, models guess randomly.
    source_lang: str = "English"
    target_lang: str = ""  # e.g. "Plains Cree (nêhiyawêwin, SRO)"

    # --- Segment names ---
    # The valid segment names in your corpus (for dataset filtering).
    # Leave empty to auto-detect from the corpus at load time.
    segment_names: list[str] = field(default_factory=list)

    # --- Model ---
    model: str = DEFAULT_MODEL  # An exact model slug (no aliases, no floating ids)
    max_tokens: int = DEFAULT_MAX_TOKENS

    # --- API provider ---
    # Which LLM API to call. "openrouter" (default) proxies any model.
    # Direct providers ("openai", "anthropic", "gemini") call vendor APIs
    # without a proxy. Uses the same vocabulary as the CLI's METHOD_REGISTRY
    # for consistency: `champollion.config.json` → harness RunConfig.
    provider: str = "openrouter"
    # OpenAI-compatible endpoint override (base_url). Lets --provider openai or
    # --provider local target Ollama/vLLM/Groq/etc. None = the provider default.
    base_url: str | None = None

    # --- Transmission policy (transmission_policy.py) ---
    # Resolved at run setup from the dataset's registry entry / corpus
    # envelope. Shape: {"restricted": bool, "reason": str,
    # "openrouter_provider_prefs": dict | None}. A restricted corpus (NC /
    # no-deriv / sealed held-out / gold-standard / quarantined / unknown
    # license) may only flow through no-train channels; the OpenRouter proxy
    # gets provider_prefs {"data_collection": "deny"} on every request.
    # Serialized into the RunLog so each result records its channel
    # discipline. None = not yet resolved.
    transmission_policy: dict | None = None
    # --allow-data-collection: lifts the fail-safe restriction for an
    # UNREGISTERED corpus the caller holds rights to. Never lifts the
    # restriction of a registered restricted corpus.
    allow_data_collection: bool = False
    # --attest-local-transport: for consent-required/sealed corpora run
    # through an EXTERNAL method (plugin transport the harness cannot see),
    # the operator attests the method's transport is fully local. Recorded
    # in the RunLog; without it such runs refuse.
    attest_local_transport: bool = False

    # --- Tool calling ---
    # Individual toggles for each tool (None = all available tools)
    tools_enabled: bool = False
    # List of individual tool names to enable, e.g. ["fst_validate", "fst_generate"]
    # None means all tools. Only used when tools_enabled is True.
    tools_list: list[str] | None = None
    max_tool_rounds: int = DEFAULT_MAX_TOOL_ROUNDS

    # --- FUSE-style comparator (opt-in) ---
    # When True, the analyzer computes the FUSE-style comparator (reported, never
    # in the composite; needs the `fuse` extra). Off by default — LaBSE is heavy.
    compute_fuse: bool = False

    # --- MetricX-24 (opt-in; neural, LOWER-IS-BETTER, reported separately) ---
    # When True, also score with MetricX-24 (Google, Apache-2.0) — the WMT24
    # Metrics shared-task winner and the metric WMT24++/TranslateGemma report
    # against. Reported in the neural lane, NEVER in the composite; needs the
    # `metricx` extra. Off by default — the mT5 backbone is heavy. metricx_model
    # overrides the checkpoint (e.g. an xl/xxl or a MetricX-25 model).
    compute_metricx: bool = False
    metricx_model: str | None = None

    # --- Caching ---
    cache_enabled: bool = DEFAULT_CACHE_ENABLED
    cache_dir: str = DEFAULT_CACHE_DIR

    # --- Batching ---
    # Entries per API call. >1 = numbered list format.
    # Tool-calling auto-overrides to 1 (each entry needs its own
    # conversation loop). See validate() for the override logic.
    batch_size: int = DEFAULT_BATCH_SIZE

    # --- Concurrency ---
    # Number of parallel API calls within a single model run.
    # Bounded by asyncio.Semaphore for rate limit safety.
    # For multi-model parallelism, use execute_multi_run().
    concurrency: int = DEFAULT_CONCURRENCY

    # --- System prompt ---
    # "naive" = minimal instruction ("translate X to Y")
    # "custom" = load from custom_prompt_path (deprecated, use coaching_file)
    # Coaching prompts are free text — the full text is recorded in the
    # run card for reproducibility. There are no named prompt versions.
    prompt_version: str = "naive"
    custom_prompt_path: str | None = None  # DEPRECATED: use coaching_file
    coaching_file: str | None = None  # Path to coaching prompt text file
    # What a published card names the coaching by. Inline --coaching text is
    # written to a temp file so it flows through coaching_file; that temp
    # path (/tmp/coaching_*.txt) used to be published as coachingFile
    # (synthetic researcher, Round 4). The CLI sets "inline coaching" here;
    # coaching_label() falls back to the file's NAME (never its directory).
    coaching_label: str | None = None
    # Evaluation glossary for terminology adherence — a SCORING input, never
    # sent to the model. Give every run you compare the same file.
    glossary_file: str | None = None
    style_profile: str | None = None  # Path to style profile JSON (informational metrics)

    # --- Post-translation hooks ---
    # List of hook names to apply (e.g. ["fst_gate"])
    # Hooks are registered externally via PostTranslationHook plugins
    post_hooks: list[str] = field(default_factory=list)

    # --- FST retry ---
    # Number of times to retry a translation that fails FST validation.
    # 0 = score-only (no retry). Works with the default LLM method only;
    # custom method plugins handle their own retry logic internally.
    fst_retries: int = 0

    # --- Output ---
    output_dir: str = DEFAULT_OUTPUT_DIR
    run_name: str | None = None  # Optional human-readable label

    # --- Misc ---
    temperature: float = DEFAULT_TEMPERATURE
    dry_run: bool = False      # Validate config without API calls
    # Pre-spend cost cap in USD (--max-cost). Before translation starts the
    # runner estimates the run's API cost (api.estimate_run_cost); if the
    # estimate exceeds this cap — or is UNKNOWN (un-priceable model; unknown
    # ≠ free, the queue_runner budget discipline) — the run aborts before any
    # spend. None = no cap (default; behavior unchanged).
    max_cost: float | None = None
    # When True the CLI was invoked with --json: human-readable output
    # (run card, interactive publish prompt) is suppressed so the only
    # thing on stdout is the machine-readable JSON summary.
    json_mode: bool = False
    # Skip interactive confirmation prompts (--yes). Required for
    # fetch-from-source corpus builds in CI/scripted runs: accepting
    # the upstream data license non-interactively. It never installs a
    # package (_check_eval_pack: `mt-eval setup` is the explicit step).
    assume_yes: bool = False
    # --skip-fst: score without FST acceptance even when the language has an
    # FST (installed or not); the run card marks it not computed and the
    # eval-pack gate does not demand the FST or its runtime.
    skip_fst: bool = False
    # --skip-eval-standard: score without the language card's eval-standard
    # metrics (e.g. an uninstalled external package); marked not computed.
    skip_eval_standard: bool = False
    # When True the CLI was invoked with --publish: after a successful run the
    # scored report is published to the leaderboard non-interactively (the
    # one-step run+publish path), instead of the interactive "Publish? [y/N]"
    # prompt. Content-safety gating is unchanged (see publish.publish_to_supabase).
    auto_publish: bool = False
    # With auto_publish: the explicit production opt-in (--prod) and the
    # sign-in-free intake (--anonymous), passed straight to
    # publish_to_supabase. Without publish_prod a prod write is refused there.
    publish_prod: bool = False
    publish_anonymous: bool = False

    # --- Method plugin ---
    # Path to a method plugin directory containing method.json + Python
    # module. When set, the harness delegates translation to the plugin
    # instead of using the built-in LLM caller. The method is a black box:
    # source text in, translation out. The harness just scores the output.
    method_path: str | None = None
    # The model handed to a method plugin with -m/--model, exactly as given,
    # "" when none was given. A plugin reads it as
    # ``config.method_model``: for a plugin run ``config.model`` is the
    # plugin's method_id (the identity the run is published under), so until
    # 2026-10-03 a plugin never saw -m at all, and the run card and
    # fingerprint dropped it — the same plugin on two models published two
    # identical fingerprints (synthetic researcher, Round 5).
    method_model: str = ""
    # Legacy alias for process_name — kept for backward compatibility
    process_name: str | None = None

    # --- Self-contained MT systems (consumer-reports adapters) ---
    # mt_method: set from --method when it names a registered MT system
    # (google-translate / deepl / microsoft-translator / libretranslate);
    # mutually exclusive with method_path (a plugin dir). source_code/target_code
    # are the ISO codes the MT REST APIs need — read by
    # methods/base_http_mt._resolve_lang_codes and auto-populated by the runner
    # from the corpus language_pair (distinct from target_lang_code, the
    # champollion-interop/FST field).
    mt_method: str = ""
    source_code: str = ""
    target_code: str = ""
    # The model an engine that runs a GIVEN model (local-model) loaded:
    # ``engine_model.from_run`` reads it. Set by the runner before the run
    # (the hub id, or the directory with a sha256 over its files) and
    # completed after it (a hub revision, the decode length). None for every
    # other run. ``method_model`` above holds what -m said; this holds what
    # loaded (synthetic researcher, Round 10).
    engine_model: dict | None = None
    # --allow-model-pair-mismatch: run an OPUS-MT pair model whose id names
    # another pair than the corpus's, on purpose (a related-language
    # baseline). Recorded on engine_model.pair_mismatch; refused without it.
    allow_model_pair_mismatch: bool = False

    # --- Champollion config interop ---
    # Enables config interchangeability with champollion production CLI.
    # When set, --prompt champollion uses the config to build production-
    # identical prompts with register, gender guidance, and promptContext.
    # Retired in 0.2.0 (champollion_config.RETIRED_MESSAGE). The field stays so
    # 0.1.x run logs still deserialize; validate() refuses a non-empty value.
    champollion_config_path: str | None = None
    # sha256 of the system prompt actually sent, set by the runner once it has
    # rendered it. Part of the cache key: two runs whose prompts differ in any
    # way (register, coaching, template) must never share cached outputs.
    rendered_prompt_sha256: str = ""
    # Retired in 0.2.0 (champollion_config.CARDS_DIR_RETIRED_MESSAGE). Kept so
    # 0.1.x run logs deserialize; validate() refuses a non-empty value.
    champollion_cards_dir: str | None = None
    target_lang_code: str = ""               # --target-lang-code (e.g., "fr")
    # When --target-lang / --source-lang was a CODE ("sme"), the name the
    # prompt uses instead, resolved through the language cards —
    # {given, code, name, resolved, why} (prompt_plan.apply_language_names).
    # Recorded so the run log says the prompt's name came from a code (or
    # that no card named it and the prompt carried the code). Round 11.
    target_lang_resolution: dict | None = None
    source_lang_resolution: dict | None = None
    # --target-script: the ISO 15924 script the output must be written in
    # (e.g. "Latn", "Cans"). The harness's prompt asks for it (runner.
    # script_instruction); a language whose card lists more than one script
    # otherwise leaves the choice to the model, and a reference in the other
    # script scores near zero for the wrong reason (Round 9, crk).
    target_script: str = ""
    # Where target_script came from when the run did not name one: the
    # references' script shares (prompt_plan.script_from_references —
    # counts only, never text). None when --target-script was given or no
    # script was chosen. Round 11.
    target_script_source: dict | None = None

    # --- Contamination self-attestation ---
    # Recorded when the submitter attests their method/model was NOT trained on
    # the evaluation corpus (set via the guided run or --attest-no-training).
    # Serialized into the run log (config + provenance) so it can surface in
    # the trust UI later. None = no attestation captured for this run.
    contamination_attestation: dict | None = None

    # --- Non-commercial terms acknowledgment ---
    # Recorded when the corpus is NonCommercial (CC-BY-NC / -NC-SA) and the
    # submitter acknowledged its non-commercial / research-only terms (via the
    # guided run, an inline prompt, or --accept-nc-terms). Serialized into the
    # run log so the leaderboard/trust UI can show the acknowledgment. None = the
    # corpus is not NC, or no acknowledgment was captured (see the run-time gate
    # in cli.py / license_use.py). [[license_use]]
    nc_terms_acknowledgment: dict | None = None

    def _target_script_errors(self) -> list[str]:
        """--target-script: an ISO 15924 code (normalized to Title case,
        "cans" → "Cans"), one of the scripts the target's card lists when it
        lists any, and only on a run whose prompt the harness writes (an MT
        engine or a method plugin is never told it)."""
        import re as _re
        code = str(self.target_script).strip()
        code = code[:1].upper() + code[1:].lower()
        if not _re.fullmatch(r"[A-Z][a-z]{3}", code):
            return [f"--target-script {self.target_script!r}: not an ISO "
                    f"15924 script code (four letters, e.g. Latn, Cans)."]
        self.target_script = code
        if self.mt_method or (self.method_path or "").strip():
            return [f"--target-script {code}: the script is asked for in the "
                    f"harness's prompt, and an MT engine or method plugin "
                    f"gets no prompt — it writes whatever script it writes. "
                    f"Leave --target-script out for this run."]
        scripts, label = target_card_scripts(self)
        if scripts and code not in scripts:
            return [f"--target-script {code}: the {label} language card lists "
                    f"{', '.join(scripts)} — pass one of those."]
        return []

    def validate(self, prompt_versions: list[str] | None = None, *,
                 eval_pack_report: list | None = None) -> list[str]:
        """Validate configuration, return list of error messages.

        Args:
            prompt_versions: Available prompt version names (built-in +
                registered plugins). If None, only validates "naive" and "custom".
            eval_pack_report: For a dry run: the eval-pack gate checks the
                real run makes here (the registry entry's, the target
                language's) are run all the same, and their verdicts
                (eval_pack_status) appended to this list instead of refusing
                — the dry run reports them and goes on. A dry run without
                the list skips the gate as before.
        """
        errors = []

        # Exact model slugs only (founder ruling 2026-10-05): a retired alias
        # ("gemini-pro") or a floating id ("~google/gemini-pro-latest") is
        # refused on every provider, naming the slug to write — never mapped.
        # On OpenRouter a bare name is refused too: its ids are vendor/model,
        # and the vendor-guessing fuzzy matcher is gone. A direct provider
        # takes that vendor's own names — `local` (Ollama/vLLM/LM Studio)
        # models are called "llama3.1" or "qwen2.5:7b".
        # Not for a method plugin (--method <dir>): its -m is handed to the
        # plugin as config.method_model, in whatever naming the plugin uses
        # ("stub-1", "qwen2.5:7b"), and the harness never calls it. Nor for an
        # MT engine (--method local-model -m ./model): -m names the engine's
        # model (a Hugging Face id or a directory), never an OpenRouter slug.
        is_plugin = bool((self.method_path or "").strip()) and not self.mt_method
        if not is_plugin and not self.mt_method:
            for one in [m.strip() for m in (self.model or "").split(",") if m.strip()]:
                refusal = exact_model_refusal(
                    one, openrouter=self.provider == "openrouter")
                if refusal:
                    errors.append(refusal)

        # Tool-calling requires batch_size=1 — auto-override with warning
        # instead of erroring, so the default batch_size=25 doesn't block
        # tool-calling runs.
        if self.tools_enabled and self.batch_size > 1:
            import sys
            print(
                f"  ⚠ batch_size={self.batch_size} auto-overridden to 1 "
                f"(tool-calling requires individual entry conversations)",
                file=sys.stderr,
            )
            self.batch_size = 1

        # Prompt version validation
        available = prompt_versions or ["naive", "custom", "coached"]
        if self.prompt_version not in available:
            errors.append(
                f"Unknown prompt_version '{self.prompt_version}'. "
                f"Available: {', '.join(available)}"
            )

        # "coached" is the auto-derived label for runs where a coaching
        # prompt replaces the naive one — it is meaningless without one.
        if self.prompt_version == "coached":
            if not (self.coaching_file or self.custom_prompt_path):
                errors.append(
                    "prompt_version='coached' requires --coaching-file or "
                    "--coaching (it is auto-set when coaching is provided)."
                )

        # Custom prompt file must exist
        if self.prompt_version == "custom":
            if not self.custom_prompt_path:
                errors.append("prompt_version='custom' requires custom_prompt_path")
            elif not Path(self.custom_prompt_path).exists():
                errors.append(f"Custom prompt file not found: {self.custom_prompt_path}")

        # The champollion-config lane was retired in 0.2.0: refused with the
        # reason and its replacement, never silently ignored.
        if self.prompt_version == "champollion" or self.champollion_config_path:
            from mt_eval_harness.champollion_config import RETIRED_MESSAGE
            errors.append(RETIRED_MESSAGE)
        if self.champollion_cards_dir:
            from mt_eval_harness.champollion_config import CARDS_DIR_RETIRED_MESSAGE
            errors.append(CARDS_DIR_RETIRED_MESSAGE)

        if self.target_script:
            errors.extend(self._target_script_errors())

        # Parallel text: both files must be provided together
        if self.source_file and not self.reference_file:
            errors.append("--source-file requires --reference-file.")
        if self.reference_file and not self.source_file:
            errors.append("--reference-file requires --source-file.")

        # Corpus path validation — try registry resolution for non-path IDs.
        # Users can pass either a filesystem path or a registry dataset ID
        # (e.g. 'edtekla-dev-v1'). If the raw path doesn't exist, try
        # resolving it through the dataset registry before erroring.
        if self.corpus_path and not Path(self.corpus_path).exists():
            corpus_ref = self.corpus_path  # the user-supplied id, pre-resolution
            try:
                resolved_path = resolve_dataset(
                    self.corpus_path, assume_yes=self.assume_yes,
                    skip_eval_pack=self.dry_run, skip_fst=self.skip_fst,
                    skip_eval_standard=self.skip_eval_standard,
                    eval_pack_report=(eval_pack_report if self.dry_run
                                      else None))
                self.corpus_path = str(resolved_path)
                # The corpus was referenced by a registry id/alias (not a file
                # path). Stamp the CANONICAL registry id as dataset_id so the
                # published run card's dataset_id joins a real datasets row (and
                # equals the queue's corpus_id) — rather than the built corpus
                # file's self-describing corpus_id (e.g. 'tatoeba-eng-ilo-dev'),
                # which corpus_loader would otherwise adopt and which joins
                # nothing. An explicit dataset_id (rare) still wins.
                if not self.dataset_id:
                    canonical = canonical_registry_id(corpus_ref)
                    if canonical:
                        self.dataset_id = canonical
            except (FileNotFoundError, ValueError) as e:
                # Fetch-from-source fallback: if a corpora card with a
                # `source` block matches this path, the corpus can be
                # rebuilt from the upstream repo at load time. Don't
                # error here — corpus_loader performs the fetch (with a
                # license prompt, or automatically with --yes/CI).
                from mt_eval_harness.corpus_fetch import find_card_for_corpus
                if find_card_for_corpus(self.corpus_path) is None:
                    errors.append(
                        f"Corpus file not found: {self.corpus_path} ({e})"
                    )

        # Eval-pack gate for direct file paths. Registry-ID resolution runs
        # the gate inside resolve_dataset(), but queue contributors download
        # the corpus JSON and pass the file path — that branch skipped the
        # gate entirely, so FST-language runs silently proceeded without the
        # FST metric (different metric coverage than baseline runs). Derive
        # the target language from the config and gate on it.
        # In a dry run the SAME check runs and its verdict is reported, not
        # enforced (eval_pack_report): the dry run used to skip it, so a Cree
        # pre-flight passed and the first confirmed run stopped on the
        # missing FST runtime (synthetic user, Round 7). Nothing is installed
        # either way.
        target_code = self.target_lang_code
        if not target_code and self.target_lang:
            from mt_eval_harness.language_cards import resolve_name
            target_code = resolve_name(self.target_lang) or ""
        if target_code and (not self.dry_run or eval_pack_report is not None):
            from mt_eval_harness.corpus_loader import marked_local_only
            gate_entry = {"id": Path(self.corpus_path).stem if self.corpus_path
                                else "(inline)",
                          "language_pair": {"target": target_code}}
            try:
                gate_kwargs = dict(
                    card_metrics_withheld=marked_local_only(
                        self.corpus_path, self.source_file,
                        self.reference_file),
                    skip_fst=self.skip_fst,
                    skip_eval_standard=self.skip_eval_standard,
                )
                if self.dry_run:
                    eval_pack_report.append(
                        eval_pack_status(gate_entry, **gate_kwargs))
                else:
                    _check_eval_pack(gate_entry, assume_yes=self.assume_yes,
                                     **gate_kwargs)
            except (RuntimeError, ValueError) as e:
                errors.append(str(e))

        # Positive integers
        if self.batch_size < 1:
            errors.append(f"batch_size must be >= 1, got {self.batch_size}")
        if self.concurrency < 1:
            errors.append(f"concurrency must be >= 1, got {self.concurrency}")
        if self.max_tokens < 100:
            errors.append(f"max_tokens must be >= 100, got {self.max_tokens}")
        if self.max_cost is not None and self.max_cost <= 0:
            errors.append(f"max_cost must be > 0 (USD), got {self.max_cost}")

        return errors

    @property
    def model_id(self) -> str:
        """The model's exact id — the model as written (nothing resolves a
        short name: founder ruling 2026-10-05, exact slugs only)."""
        return self.model

    @property
    def method_id(self) -> str:
        """Identity of the method plugin under test ('' when no method_path).

        Resolved from the plugin dir's method.json and cached on first access
        (outside the dataclass fields, so it never leaks into to_dict / the
        run log). Resolution is display-grade and NEVER crashes: prefer the
        validated card's method_id (load_method_card), fall back to the raw
        manifest's method_id (a card can fail schema validation yet still
        carry an honest id — e.g. an off-taxonomy class), and finally to the
        plugin dir basename as a stable last-resort label.
        """
        if not self.method_path:
            return ""
        cached = self.__dict__.get("_method_id_cache")
        if cached is not None:
            return cached
        card_path = Path(self.method_path) / "method.json"
        resolved = ""
        try:
            resolved = load_method_card(card_path).get("method_id") or ""
        except Exception:
            try:
                raw = json.loads(card_path.read_text(encoding="utf-8"))
                resolved = (raw.get("method_id") or "") if isinstance(raw, dict) else ""
            except Exception:
                resolved = ""
        if not resolved:
            resolved = Path(self.method_path).name
        self.__dict__["_method_id_cache"] = resolved
        return resolved

    @property
    def display_model(self) -> str:
        """Human/run-id label for the system actually under test.

        Self-contained MT systems (--method google-translate, deepl, …) and
        method plugins (--method path/to/dir) carry their own engine and
        never touch the LLM ``model`` field — which stays at its default
        (DEFAULT_MODEL). Without this, the default LLM slug leaked into the
        banner, the run id, and the --json summary of an MT or method-plugin
        run. Prefer ``mt_method``, then the plugin's ``method_id`` (empty
        unless ``method_path`` is set), then the LLM model.
        """
        return self.mt_method or self.method_id or self.model

    @property
    def effective_temperature(self) -> float:
        """Return temperature, adjusted for models that reject exactly 0."""
        if self.temperature == 0 and self.model_id in NEEDS_NONZERO_TEMP:
            return 0.01
        return self.temperature

    @property
    def transmission_provider_prefs(self) -> dict | None:
        """OpenRouter provider prefs required by this run's transmission policy.

        None when the corpus is unrestricted (or the policy has not been
        resolved); the strategies pass this on every API call, so a restricted
        corpus can never reach a data-collecting provider through the proxy.
        """
        pol = self.transmission_policy or {}
        if not pol.get("restricted"):
            return None
        return pol.get("openrouter_provider_prefs")

    def config_hash(self) -> str:
        """Deterministic hash of the config for cache keying.

        Excludes output_dir, run_name, dry_run, and corpus_path since
        they don't affect the actual translation results.
        """
        # Build a dict of only the fields that affect output
        relevant = {
            "model": self.model_id,
            "max_tokens": self.max_tokens,
            "tools_enabled": self.tools_enabled,
            "tools_list": sorted(self.tools_list) if self.tools_list else None,
            "batch_size": self.batch_size,
            "prompt_version": self.prompt_version,
            "post_hooks": sorted(self.post_hooks),
            "temperature": self.effective_temperature,
            "process_name": self.process_name,
            # Language pair affects prompts, so it must affect cache keys.
            # Otherwise switching target_lang would serve stale translations.
            "source_lang": self.source_lang,
            "target_lang": self.target_lang,
            # Coaching prompt content hash — different coaching files should
            # produce different cache keys. We hash the content, not the path,
            # so identical prompts in different files still share cache.
            "coaching_sha": self._coaching_content_hash(),
            # FST retry count affects the final translation output (retried
            # translations may differ from first-pass ones).
            "fst_retries": self.fst_retries,
            # Provider affects the exact API used, which can produce different
            # outputs for the same model/prompt (e.g., OpenRouter vs direct).
            "provider": self.provider,
            # Endpoint override: the same model at a different base_url can
            # yield different outputs, so it must not collide in the cache.
            "base_url": self.base_url,
            # The prompt as SENT (covers every way a prompt is built, not just
            # the coaching file) and the harness version as a cache epoch: a
            # scoring-path fix must never be served outputs cached before it.
            "rendered_prompt_sha256": self.rendered_prompt_sha256,
            "harness_version": _harness_version(),
        }
        # The model a method plugin is handed (-m) and the model an engine
        # loads (its directory's content hash, or its hub revision): two runs
        # of one plugin or one engine on different models must never share
        # cached outputs. Before Round 10 both keyed on the method id alone,
        # so `--method local-model -m A` then `-m B` would have served A's
        # translations as B's. Added only when set, so every other run's
        # cache namespace is unchanged.
        if self.method_model:
            relevant["method_model"] = self.method_model
        if isinstance(self.engine_model, dict) and self.engine_model.get("id"):
            # A directory by its content hash; a hub id by the id alone (its
            # revision is only known once it loads, after the cache opened).
            relevant["engine_model"] = {
                "id": self.engine_model.get("id"),
                "sha256": self.engine_model.get("sha256"),
            }
        raw = json.dumps(relevant, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()[:12]

    def _coaching_content_hash(self) -> str | None:
        """Hash the coaching file content for cache keying.

        Returns None if no coaching file is set, so the cache key
        doesn't change for non-coached runs.
        """
        path = self.coaching_file or self.custom_prompt_path
        if not path:
            return None
        try:
            content = Path(path).read_bytes()
            return hashlib.sha256(content).hexdigest()[:12]
        except (FileNotFoundError, OSError):
            # If the file doesn't exist, include the path as a fallback
            # so different missing paths don't share cache keys.
            return hashlib.sha256(path.encode()).hexdigest()[:12]

    def to_dict(self) -> dict:
        """Serialize config to dict for JSON storage."""
        d = asdict(self)
        # Add computed fields for convenience
        d["_model_id"] = self.model_id
        d["_effective_temperature"] = self.effective_temperature
        d["_config_hash"] = self.config_hash()
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "RunConfig":
        """Deserialize config from dict (e.g., loaded from a RunLog)."""
        # Strip computed fields
        d = {k: v for k, v in d.items() if not k.startswith("_")}
        # Strip any fields not in the dataclass (forward compatibility)
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}
        d = {k: v for k, v in d.items() if k in valid_fields}
        return cls(**d)
