"""
Setup wizard — Interactive dependency installer for the mt-eval harness.

Provides a friendly `mt-eval setup` command that walks users through
installing optional capabilities. Users should never need to know
specific pip commands — the harness explains what each capability does,
when it's recommended, and handles installation on consent.

DESIGN PHILOSOPHY:
    Ship lean, install on consent. The harness core has minimal deps
    (aiohttp, dotenv, sacrebleu). Everything else is optional:

    1. COMET (unbabel-comet) — Neural MT quality metric. ~2.3 GB model
       download on first use. Recommended for all evaluations.
    2. FSTs (pyhfst) — Morphological validation for polysynthetic
       languages. Required for accurate eval of CRK, SME, etc.
    3. Both — Full recommended setup.

    The setup wizard is also invoked contextually: when `mt-eval test`
    encounters a missing optional dep that would improve the eval, it
    offers to install it right there instead of just printing a pip
    command.

USAGE:
    mt-eval setup              # Interactive wizard
    mt-eval setup --all        # Install everything, no prompts
    mt-eval setup --comet      # Install just COMET
    mt-eval setup --fst        # Install just FST support
    mt-eval setup --status     # Show what's installed
"""

from __future__ import annotations

import importlib.util
import re
import shlex
import subprocess
import sys
from pathlib import Path


# ── Status checks ────────────────────────────────────────────────

def check_comet_installed() -> bool:
    """Check if unbabel-comet is importable."""
    try:
        from comet import download_model  # noqa: F401
        return True
    except ImportError:
        return False


def check_pyhfst_installed() -> bool:
    """Check if pyhfst is importable."""
    try:
        import pyhfst  # noqa: F401
        return True
    except ImportError:
        return False


def check_spacy_installed() -> bool:
    """Check if spaCy and en_core_web_md model are importable."""
    try:
        import spacy
        spacy.load("en_core_web_md")
        return True
    except (ImportError, OSError):
        return False


def _fst_display_name(code: str) -> str:
    """The pin's own name for the FST, else the card's language name."""
    from mt_eval_harness import language_cards as _lc
    pin = _lc.get_fst_pin(code) or {}
    if pin.get("name"):
        return pin["name"]
    try:
        return _lc.get_name(code) or code
    except Exception:  # noqa: BLE001 — a status line must not die on an offline index
        return code


def get_installed_fsts() -> list[dict]:
    """List FSTs that have been downloaded to the cache.

    Walks the pinned languages (a dozen), never the whole card index: from a
    pip install every card is a network fetch, and walking all ~8,700 of
    them made `mt-eval setup --status` hang for many minutes.
    """
    from mt_eval_harness.plugins.fst_installer import (
        FST_CACHE_ROOT,
        find_analyzer_hfstol,
    )
    from mt_eval_harness import language_cards as _lc

    installed = []
    for code in _lc.fst_pinned_codes():
        fst_dir = FST_CACHE_ROOT / code
        if fst_dir.exists():
            analyzer = find_analyzer_hfstol(fst_dir)
            if analyzer:
                installed.append({
                    "code": code,
                    "name": _fst_display_name(code),
                    "analyzer": analyzer.name,
                    "path": str(fst_dir),
                })
    return installed


def print_status():
    """Print a summary of what's installed and what's available."""
    print()
    print("  ┌──────────────────────────────────────────────────────────┐")
    print("  │  MT Eval Harness — Dependency Status                    │")
    print("  └──────────────────────────────────────────────────────────┘")
    print()

    # Core (always installed)
    print("  Core (always installed):")
    print("    ✅ sacrebleu    — chrF++, BLEU metrics")
    print("    ✅ aiohttp      — Async HTTP for API calls")
    print("    ✅ dotenv       — Environment variable management")
    print()

    # COMET
    comet_ok = check_comet_installed()
    if comet_ok:
        from mt_eval_harness.metrics_comet import DEFAULT_COMET_MODEL
        print(f"  Neural metrics:")
        print(f"    ✅ unbabel-comet — COMET neural metric ({DEFAULT_COMET_MODEL})")
        print(f"       AfriCOMET auto-selects for 35 African languages")
    else:
        from mt_eval_harness.metrics_comet import COMET_IMPORT_ERROR, comet_python_blocker
        print("  Neural metrics:")
        blocker = comet_python_blocker()
        if blocker:
            print(f"    ❌ unbabel-comet — cannot run on this Python: {blocker}")
        elif COMET_IMPORT_ERROR and "No module named 'comet'" not in COMET_IMPORT_ERROR:
            print(f"    ❌ unbabel-comet — installed but does not import ({COMET_IMPORT_ERROR})")
        else:
            print("    ❌ unbabel-comet — Not installed")
        print("       COMET provides the best correlation with human quality")
        print("       judgments (WMT primary metric since 2022). Recommended")
        print("       for all evaluations. ~2.3 GB model downloads on first use.")
    print()

    # FST — one reading per pinned language (config.fst_state), the same
    # words the eval-pack lines, the run's advisory and the MCP server use.
    # This block used to say pinned FSTs "auto-download on first eval" and
    # that `mt-eval test` would fetch one: nothing downloads by itself
    # (synthetic school persona, Round 8).
    fst_ok = check_pyhfst_installed()
    fst_list = get_installed_fsts()
    print("  Morphological validation (FST):")
    if fst_ok:
        print("    ✅ pyhfst       — HFST transducer runtime")
    else:
        print("    ❌ pyhfst       — HFST transducer runtime: not installed "
              "(mt-eval setup --fst, or with an FST: mt-eval setup --lang <code>)")
    from mt_eval_harness import language_cards as _lc
    from mt_eval_harness.config import fst_state
    by_code = {f["code"]: f for f in fst_list}
    for code in _lc.fst_pinned_codes():
        state = fst_state(code)
        if state is None:
            continue
        name = _fst_display_name(code)
        if state["analyzer_installed"]:
            analyzer = (by_code.get(code) or {}).get("analyzer")
            print(f"    ✅ {code:3s} — {name}"
                  + (f" ({analyzer})" if analyzer else ""))
            continue
        maturity = ((_lc.get_fst_install_info(code) or {}).get("maturity")
                    or "")
        stub = " (dev/stub — limited vocabulary)" if maturity == "stub" else ""
        how = (f"mt-eval setup --lang {code}" if state["auto_install"]
               else f"manual install, format {state['format']!r} — see the "
                    f"language card's FST install notes")
        print(f"    ○ {code:3s} — {name}{stub}: not installed ({how})")
    print("       Nothing downloads by itself: an FST arrives through "
          "`mt-eval setup --lang <code>` (or by hand, for a manual format).")
    print("       A run without it proceeds; FST acceptance and morphology are "
          "marked not computed.")
    print()

    # spaCy
    spacy_ok = check_spacy_installed()
    if spacy_ok:
        print(f"  Semantic validation:")
        print(f"    ✅ spaCy         — NLP library")
        print(f"    ✅ en_core_web_md — Word vectors for content-word overlap")
    else:
        print("  Semantic validation:")
        print("    ❌ spaCy         — Not installed")
        print("       Required for LYSS-sem semantic validation (content-word overlap).")
        print("       Only an optional eval-standard add-on uses it: `mt-eval setup")
        print("       --lang <code>` installs it once that add-on is installed.")
    print()

    print("  ─────────────────────────────────────────────────────────")
    print("  Install everything:  mt-eval setup --all")
    print("  Install COMET only:  mt-eval setup --comet")
    print("  Install FST only:    mt-eval setup --fst")
    print("  Install lang deps:   mt-eval setup --lang <code>   (e.g. crk)")
    print()


# ── Installation helpers ─────────────────────────────────────────

def _pip_subprocess_env() -> dict | None:
    """Environment for pip-driven subprocesses on imperfect systems.

    Two real-world walls between `--yes` automation and a clean install:

    1. PEP 668: Homebrew/Debian pythons mark their site-packages
       EXTERNALLY-MANAGED and bare `pip install` exits 1. When we're NOT
       in a venv and the marker is present, route installs to the user
       site (PIP_USER) with the managed-environment override. Inside a
       venv (pipx, the curl installer, CI) pip works as-is.
    2. Tools that shell out to a `pip` EXECUTABLE (`spacy download` does)
       fail on systems that only ship `pip3`. Provide a `pip` shim in
       ~/.mt-eval/bin and prepend it to PATH.

    Returns None when the ambient environment needs neither.
    """
    import os
    import shutil
    import sysconfig

    env = None

    in_venv = sys.prefix != getattr(sys, "base_prefix", sys.prefix)
    marker = Path(sysconfig.get_path("stdlib")) / "EXTERNALLY-MANAGED"
    if not in_venv and marker.exists():
        env = os.environ.copy()
        env["PIP_BREAK_SYSTEM_PACKAGES"] = "1"
        env["PIP_USER"] = "1"

    if shutil.which("pip") is None:
        shim_dir = Path.home() / ".mt-eval" / "bin"
        shim = shim_dir / "pip"
        if not shim.exists():
            shim_dir.mkdir(parents=True, exist_ok=True)
            shim.write_text(
                f'#!/bin/sh\nexec "{sys.executable}" -m pip "$@"\n',
                encoding="utf-8",
            )
            shim.chmod(0o755)
        env = env or os.environ.copy()
        env["PATH"] = f"{shim_dir}{os.pathsep}{env.get('PATH', '')}"

    return env


def _externally_managed() -> bool:
    """True when this is a PEP 668 system Python outside any venv."""
    import sysconfig
    in_venv = sys.prefix != getattr(sys, "base_prefix", sys.prefix)
    marker = Path(sysconfig.get_path("stdlib")) / "EXTERNALLY-MANAGED"
    return not in_venv and marker.exists()


def _uv_created_venv() -> bool:
    """True when this interpreter runs in a venv ``uv venv`` made (its
    pyvenv.cfg records a ``uv = <version>`` key)."""
    if sys.prefix == getattr(sys, "base_prefix", sys.prefix):
        return False
    try:
        cfg = (Path(sys.prefix) / "pyvenv.cfg").read_text(encoding="utf-8")
    except OSError:
        return False
    return any(line.partition("=")[0].strip() == "uv"
               for line in cfg.splitlines())


def pip_install_hint(*specs: str) -> str:
    """How to SAY "install these" in a message — the one wording every
    setup, eval-pack, metric and plugin message uses.

    ``python3 -m pip install …``: a bare ``pip`` may not be on PATH (a venv
    ``uv venv`` made has no pip executable; the synthetic researcher's
    ``pip install`` failed where ``python3 -m pip`` worked — Round 8). In a
    uv-made venv with no pip module at all, ``uv pip install …``. Each spec
    is shell-quoted (``'mt-eval-harness[metricx]'``). Display only — the
    install itself is :func:`pip_install_command`.
    """
    import importlib.util
    args = " ".join(shlex.quote(s) for s in specs)
    if _uv_created_venv() and importlib.util.find_spec("pip") is None:
        return f"uv pip install {args}"
    return f"python3 -m pip install {args}"


def pip_install_command(specs: list[str]) -> list[str] | None:
    """The command that installs ``specs`` into THIS interpreter, or None.

    A venv made by ``uv venv`` has no pip at all, and ``python -m pip`` then
    fails with "No module named pip" — every auto-install the harness offers
    (FST runtime, COMET, an eval standard) died that way from a clean uv
    install. Bootstrap pip with the stdlib's ``ensurepip`` first, because
    steps that follow shell out to pip themselves (``spacy download``); fall
    back to ``uv pip install --python <this interpreter>`` when ensurepip is
    unavailable (some distro pythons strip it).
    """
    import importlib
    import importlib.util
    import shutil

    if importlib.util.find_spec("pip") is None:
        try:
            subprocess.run([sys.executable, "-m", "ensurepip", "--upgrade"],
                           capture_output=True, text=True, timeout=300,
                           check=False)
        except (OSError, subprocess.TimeoutExpired):
            pass
        importlib.invalidate_caches()
    if importlib.util.find_spec("pip") is not None:
        return [sys.executable, "-m", "pip", "install", *specs]
    uv = shutil.which("uv")
    if uv:
        return [uv, "pip", "install", "--python", sys.executable, *specs]
    return None


def _pip_install(package_spec: str | tuple[str, ...], description: str) -> bool:
    """Run pip install with user feedback.

    Args:
        package_spec: pip install argument(s) (e.g. "unbabel-comet>=2.2", or a
            tuple of requirement strings installed together)
        description: Human-readable name for display

    Returns:
        True if install succeeded, False otherwise
    """
    specs = [package_spec] if isinstance(package_spec, str) else list(package_spec)
    print(f"\n  Installing {description}...")
    cmd = pip_install_command(specs)
    if cmd is None:
        print(f"\n  ❌ {description}: this Python ({sys.executable}) has no pip, "
              "ensurepip is unavailable, and uv is not on PATH. Install it "
              f"yourself into this environment: {' '.join(specs)}")
        return False
    print(f"  → {' '.join(cmd[:2]) if cmd[0] != sys.executable else 'pip'} "
          f"install {' '.join(specs)}")
    pip_env = _pip_subprocess_env()
    if _externally_managed():
        print("  (externally-managed python detected — installing to the "
              "user site)")
    print()

    try:
        result = subprocess.run(
            cmd,
            capture_output=False,  # Show pip output in real-time
            text=True,
            timeout=600,  # 10 min timeout (COMET model downloads are large)
            env=pip_env,
        )
        if result.returncode == 0:
            print(f"\n  ✅ {description} installed successfully.")
            return True
        else:
            print(f"\n  ❌ {description} installation failed (exit code {result.returncode}).")
            return False
    except subprocess.TimeoutExpired:
        print(f"\n  ❌ {description} installation timed out after 10 minutes.")
        return False
    except Exception as e:
        print(f"\n  ❌ {description} installation failed: {e}")
        return False


def install_comet(interactive: bool = True) -> bool:
    """Install unbabel-comet with user consent.

    Args:
        interactive: If True, prompt for confirmation. If False, install directly.

    Returns:
        True if installed (or already present), False if user declined or failed.
    """
    if check_comet_installed():
        print("  ✅ COMET already installed.")
        return True

    if interactive and sys.stdin.isatty():
        print()
        print("  ┌──────────────────────────────────────────────────────────┐")
        print("  │  Install COMET Neural Metric                            │")
        print("  │                                                         │")
        print("  │  COMET is the WMT primary metric for MT evaluation.     │")
        print("  │  It uses multilingual embeddings to score translations   │")
        print("  │  based on human quality judgments — far more reliable    │")
        print("  │  than surface-level metrics (chrF++, BLEU) alone.       │")
        print("  │                                                         │")
        print("  │  For African languages, AfriCOMET auto-selects for      │")
        print("  │  better correlation with human judgments.                │")
        print("  │                                                         │")
        print("  │  Requires: ~300 MB pip install + ~2.3 GB model download │")
        print("  │  (model downloads on first use, cached afterwards)      │")
        print("  └──────────────────────────────────────────────────────────┘")
        print()

        try:
            answer = input("  Install COMET? [Y/n]: ").strip().lower()
            if answer in ("n", "no"):
                print("  Skipped COMET installation.")
                return False
        except (EOFError, KeyboardInterrupt):
            print()
            return False

    from mt_eval_harness.metrics_comet import COMET_PIP_SPECS, comet_python_blocker
    blocker = comet_python_blocker()
    if blocker:
        print(f"  ❌ COMET cannot run here: {blocker}")
        return False
    if not _pip_install(COMET_PIP_SPECS, "COMET neural metric (unbabel-comet)"):
        return False
    # pip exiting 0 is not COMET working: a fresh install once could not import
    # at all (torchmetrics 0.10 needs pkg_resources). Prove it in a fresh
    # interpreter, since this one has already cached the failed import.
    probe = subprocess.run(
        [sys.executable, "-c", "from comet import download_model, load_from_checkpoint"],
        capture_output=True, text=True, timeout=300)
    if probe.returncode != 0:
        last = (probe.stderr.strip().splitlines() or ["no output"])[-1]
        print(f"  ❌ unbabel-comet installed but does not import: {last}")
        return False
    print("  ✅ COMET imports cleanly (restart the command to use it).")
    return True


def install_pyhfst(interactive: bool = True) -> bool:
    """Install pyhfst with user consent.

    Args:
        interactive: If True, prompt for confirmation. If False, install directly.

    Returns:
        True if installed (or already present), False if user declined or failed.
    """
    if check_pyhfst_installed():
        print("  ✅ pyhfst already installed.")
        return True

    if interactive and sys.stdin.isatty():
        print()
        print("  ┌──────────────────────────────────────────────────────────┐")
        print("  │  Install FST Runtime (pyhfst)                           │")
        print("  │                                                         │")
        print("  │  FST transducers validate morphological correctness     │")
        print("  │  of translations — essential for polysynthetic and      │")
        print("  │  agglutinative languages (Plains Cree, North Sámi,      │")
        print("  │  Quechua, Finnish, etc.).                               │")
        print("  │                                                         │")
        print("  │  The pyhfst runtime is small (~5 MB). Language-specific │")
        print("  │  transducers (5-30 MB each) download on first eval.     │")
        print("  └──────────────────────────────────────────────────────────┘")
        print()

        try:
            answer = input("  Install pyhfst? [Y/n]: ").strip().lower()
            if answer in ("n", "no"):
                print("  Skipped pyhfst installation.")
                return False
        except (EOFError, KeyboardInterrupt):
            print()
            return False

    return _pip_install("pyhfst>=1.4", "FST runtime (pyhfst)")


# ---------------------------------------------------------------------------
# Generic language eval pack installer
# ---------------------------------------------------------------------------
#
# Reads the evalPack field from the language card and installs whatever
# it declares. No language-specific code. Adding support for a new
# language = editing the language card JSON.

def _importable(import_name: str) -> bool:
    """True when ``import_name`` imports here (present-but-broken = missing)."""
    try:
        __import__(import_name)
        return True
    except ImportError:
        return False


def _package_installed(package: str) -> bool:
    """True when the top-level package ``package`` is findable (not imported)."""
    try:
        return importlib.util.find_spec(package) is not None
    except (ImportError, ValueError):
        # ValueError: already in sys.modules with no __spec__ — it IS loaded.
        return package in sys.modules


def _requirement_name(spec: str) -> str | None:
    """PEP 503-normalized project name of a PEP 508 requirement string.

    ``"spacy>=3.7"`` → ``"spacy"``; ``"Foo_Bar[x]>=1"`` → ``"foo-bar"``.
    """
    m = re.match(r"\s*([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)", str(spec or ""))
    return re.sub(r"[-_.]+", "-", m.group(1)).lower() if m else None


def split_eval_pack(lang_code: str, pack: dict | None = None) -> dict:
    """Split a language's evalPack into what setup installs now and what waits.

    The card's ``evalPack`` is one flat install list, but part of it can
    belong to an OPTIONAL add-on: the card's ``evalMetrics`` name, per metric,
    the external package that provides it (the top-level package of
    ``module``) and that metric's own runtime needs (``dependencies`` — pip
    requirement strings — and ``spacy_models``). When the providing package is
    NOT installed, a need declared ONLY by its metrics serves nothing that can
    run, so setup defers it instead of installing it for no metric (a synthetic
    Cree-school run downloaded spaCy + a 33.5 MB English model for LYSS-sem
    with the LYSS add-on absent, 2026-10-03). Nothing here names a language,
    a package or a model — every link comes from the card:

    * a ``pythonDeps`` entry is deferred when its requirement name is declared
      in ``dependencies`` by a metric of an uninstalled package and by no metric
      whose package is installed;
    * a ``postInstall`` step is deferred when the module it runs (the steps run
      as ``python -m <command>``, so the first word) is a deferred pythonDep, or
      when it names a ``spacy_models`` entry declared only by such metrics.

    A need no metric declares (pyhfst for the harness's own FST lane) stays.

    Returns:
        ``{"pythonDeps": {...}, "postInstall": [...], "deferred": [addon, ...]}``
        where each addon is ``{"package", "import", "pip", "metrics",
        "pythonDeps", "postInstall"}`` — ``pip`` is the card's
        ``evalStandard.pip`` when that standard provides the metrics, else None.
    """
    from mt_eval_harness import language_cards as _lc

    if pack is None:
        pack = _lc.get_eval_pack(lang_code) or {}
    python_deps = dict(pack.get("pythonDeps") or {})
    post_install = list(pack.get("postInstall") or [])
    eval_metrics = _lc.get_eval_metrics(lang_code) or {}
    standard = _lc.get_eval_standard(lang_code) or {}

    active_reqs: set[str] = set()
    active_models: set[str] = set()
    absent: dict[str, dict] = {}
    for metric_name, decl in sorted(eval_metrics.items()):
        decl = decl or {}
        owner = str(decl.get("module") or "").split(".")[0]
        reqs = {r for r in map(_requirement_name, decl.get("dependencies") or []) if r}
        models = {str(m) for m in decl.get("spacy_models") or []}
        if owner and not _package_installed(owner):
            entry = absent.setdefault(owner, {"metrics": [], "reqs": set(), "models": set()})
            entry["metrics"].append(metric_name)
            entry["reqs"] |= reqs
            entry["models"] |= models
        else:
            active_reqs |= reqs
            active_models |= models

    req_owner: dict[str, str] = {}
    model_owner: dict[str, str] = {}
    addons: dict[str, dict] = {}
    for owner, entry in absent.items():
        for req in entry["reqs"] - active_reqs:
            req_owner.setdefault(req, owner)
        for model in entry["models"] - active_models:
            model_owner.setdefault(model, owner)
        provided_by_standard = standard.get("import") == owner
        addons[owner] = {
            "package": (standard.get("package") if provided_by_standard else None) or owner,
            "import": owner,
            "pip": standard.get("pip") if provided_by_standard else None,
            "metrics": entry["metrics"],
            "pythonDeps": {},
            "postInstall": [],
        }

    install_deps: dict[str, str] = {}
    for import_name, pip_spec in python_deps.items():
        owner = req_owner.get(_requirement_name(pip_spec) or "")
        if owner:
            addons[owner]["pythonDeps"][import_name] = pip_spec
        else:
            install_deps[import_name] = pip_spec

    module_owner = {imp: owner for owner, a in addons.items() for imp in a["pythonDeps"]}
    install_post: list[dict] = []
    for step in post_install:
        words = str((step or {}).get("command") or "").split()
        owner = (module_owner.get(words[0]) if words else None) or next(
            (model_owner[w] for w in words if w in model_owner), None)
        if owner:
            addons[owner]["postInstall"].append(step)
        else:
            install_post.append(step)

    return {
        "pythonDeps": install_deps,
        "postInstall": install_post,
        "deferred": [a for a in addons.values() if a["pythonDeps"] or a["postInstall"]],
    }


def addon_skip_line(lang_code: str, addon: dict) -> str:
    """The one line naming a skipped optional add-on and how to add it."""
    skipped = [*addon["pythonDeps"].values(),
               *((s.get("label") or s.get("command")) for s in addon["postInstall"])]
    how = (pip_install_hint(addon["pip"]) if addon.get("pip")
           else f"install the package that provides '{addon['import']}'")
    return (f"  ℹ️  Optional add-on {addon['package']} (metrics: "
            f"{', '.join(addon['metrics'])}) is not installed, so setup skipped "
            f"what only it uses: {'; '.join(skipped)}. To add it: {how}, then "
            f"re-run `mt-eval setup --lang {lang_code}`.")


def install_lang(lang_code: str, interactive: bool = True) -> bool:
    """Install eval pack for any language, driven by language card data.

    Reads the ``evalPack`` field from the language card and installs:
    1. Python dependencies (pip install)
    2. Post-install commands (e.g., spaCy model downloads)
    3. FST morphological analyzer files (if requiresFst is set)

    Parts of the pack that only an optional, uninstalled add-on uses are
    skipped, with one printed line per add-on saying how to add it
    (see split_eval_pack).

    Args:
        lang_code: ISO 639-3 language code (e.g., "crk", "sme").
        interactive: If True and TTY is available, prompt before installing.

    Returns:
        True if all dependencies were installed successfully.
    """
    from mt_eval_harness.language_cards import get_eval_pack, get_name

    pack = get_eval_pack(lang_code)
    if not pack:
        lang_name = get_name(lang_code) or lang_code
        print(f"  ℹ️  No eval pack defined for {lang_name} ({lang_code}).")
        print(f"     This language can be evaluated with default metrics.")
        return True

    lang_name = get_name(lang_code) or lang_code
    description = pack.get("description", "Language-specific evaluation tools")
    plan = split_eval_pack(lang_code, pack)
    python_deps = plan["pythonDeps"]
    post_install = plan["postInstall"]
    requires_fst = pack.get("requiresFst", False)
    for addon in plan["deferred"]:
        print(addon_skip_line(lang_code, addon))

    # Check what's already installed
    missing_deps = {}
    for import_name, pip_spec in python_deps.items():
        if not _importable(import_name):
            missing_deps[import_name] = pip_spec

    fst_needed = False
    if requires_fst:
        try:
            from mt_eval_harness.plugins.fst_installer import is_fst_installed
            fst_needed = not is_fst_installed(lang_code)
        except ImportError:
            fst_needed = True

    if not missing_deps and not fst_needed:
        print(f"  ✅ {lang_name} ({lang_code}) eval pack already installed.")
        return True

    # Interactive confirmation
    if interactive and sys.stdin.isatty():
        print()
        print(f"  ┌──────────────────────────────────────────────────────────┐")
        print(f"  │  Install Eval Pack: {lang_name:<36} │")
        print(f"  │                                                          │")
        print(f"  │  {description:<56} │")
        print(f"  │                                                          │")
        if missing_deps:
            print(f"  │  Python packages:                                        │")
            for pip_spec in missing_deps.values():
                print(f"  │    • {pip_spec:<52} │")
        if fst_needed:
            print(f"  │  FST morphological analyzer (GiellaLT)                  │")
        if post_install:
            print(f"  │  Post-install steps: {len(post_install):<34} │")
        print(f"  └──────────────────────────────────────────────────────────┘")
        print()
        try:
            answer = input(f"  Install {lang_name} eval pack? [Y/n]: ").strip().lower()
            if answer in ("n", "no"):
                print(f"  Skipped {lang_name} eval pack installation.")
                return False
        except (EOFError, KeyboardInterrupt):
            print()
            return False

    # Install Python dependencies
    for import_name, pip_spec in missing_deps.items():
        if not _pip_install(pip_spec, import_name):
            return False

    # Run post-install commands (e.g., spaCy model downloads)
    for step in post_install:
        command = step.get("command", "")
        label = step.get("label", command)
        if not command:
            continue
        print(f"\n  Running post-install: {label}...")
        try:
            result = subprocess.run(
                [sys.executable, "-m"] + command.split(),
                capture_output=False, text=True, timeout=300,
                env=_pip_subprocess_env(),  # spacy download shells out to pip
            )
            if result.returncode != 0:
                print(f"  ❌ Post-install step failed: {label}")
                return False
            print(f"  ✅ {label} completed.")
        except Exception as e:
            print(f"  ❌ Post-install step failed: {label}: {e}")
            return False

    # Download FST files if required
    if fst_needed:
        print(f"\n  Downloading FST for {lang_name}...")
        try:
            from mt_eval_harness.plugins.fst_installer import install_fst
            install_fst(lang_code)
            print(f"  ✅ {lang_name} FST installed.")
        except Exception as e:
            print(f"  ❌ FST download failed: {e}")
            return False

    print(f"  ✅ {lang_name} ({lang_code}) eval pack installed successfully.")
    return True



# ── Interactive wizard ───────────────────────────────────────────

def run_setup(
    install_all: bool = False,
    comet_only: bool = False,
    fst_only: bool = False,
    lang_code: str | None = None,
    status_only: bool = False,
    non_interactive: bool = False,
):
    """Run the interactive setup wizard.

    Args:
        install_all: Install everything without prompts
        comet_only: Install just COMET
        fst_only: Install just FST support
        lang_code: Install eval pack for a specific language (e.g., "crk")
        status_only: Just show current status
        non_interactive: never prompt (``--non-interactive`` / ``--json``,
            or no terminal): with no install flag, show the status and the
            commands instead of the [Y/n] wizard. The explicit install flags
            never prompt anyway.
    """
    if status_only:
        print_status()
        return

    if install_all:
        print("\n  Installing all optional dependencies...\n")
        comet_ok = install_comet(interactive=False)
        fst_ok = install_pyhfst(interactive=False)
        print()
        if comet_ok and fst_ok:
            print("  ✅ Full setup complete. All optional metrics available.")
        else:
            print("  ⚠  Some installations failed. Run `mt-eval setup --status` to check.")
        return

    if comet_only:
        install_comet(interactive=False)
        return

    if fst_only:
        install_pyhfst(interactive=False)
        return

    if lang_code:
        install_lang(lang_code, interactive=False)
        return

    if non_interactive or not sys.stdin.isatty():
        # Nobody to answer [Y/n]: say what is there and what each install
        # command does, and install nothing (installing stays an explicit act).
        print_status()
        print("  Non-interactive: nothing was installed. Pick one of the "
              "commands above.")
        return

    # Full interactive wizard
    print()
    print("  ┌──────────────────────────────────────────────────────────┐")
    print("  │  MT Eval Harness — Setup Wizard                         │")
    print("  │                                                         │")
    print("  │  The harness ships lean. Optional capabilities install   │")
    print("  │  on consent — you choose what you need.                 │")
    print("  └──────────────────────────────────────────────────────────┘")

    print_status()

    needs_comet = not check_comet_installed()
    needs_fst = not check_pyhfst_installed()

    if not needs_comet and not needs_fst:
        print("  ✅ Everything is already installed. You're good to go!")
        print()
        return

    if needs_comet:
        install_comet(interactive=True)

    if needs_fst:
        install_pyhfst(interactive=True)

    print()
    print("  Setup complete. Run `mt-eval setup --status` to verify.")
    print()


# ── Contextual prompts (used by tester.py) ───────────────────────

def prompt_comet_install() -> bool:
    """Say how to install COMET when it is missing during an eval.

    Called from tester.py when HAS_COMET is False. Scoring installs nothing:
    this used to offer "Install COMET now? [Y/n]" (Enter = a ~300 MB pip
    install plus a 2.3 GB model) in the middle of a test run. Installing is
    the explicit `mt-eval setup --comet` step, which says what it installs.

    Returns:
        False — COMET is never made available by this call.
    """
    from mt_eval_harness.metrics_comet import comet_unavailable_reason
    why = comet_unavailable_reason() or "COMET is not available"
    # "⚠" first: the notice must survive a status trim that keeps warning
    # lines (MCP get_run_status), and read as the warning it is.
    print(f"  ⚠ COMET: not computed — {why.rstrip('.')}"
          + (" (~300 MB install + ~2.3 GB model on first use)."
             if why.endswith("setup --comet") else "."))
    return False

