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


def get_installed_fsts() -> list[dict]:
    """List FSTs that have been downloaded to the cache."""
    from mt_eval_harness.plugins.fst_installer import (
        FST_CACHE_ROOT,
        find_analyzer_hfstol,
    )
    from mt_eval_harness import language_cards as _lc

    installed = []
    for code in _lc.get_all_codes():
        info = _lc.get_fst_install_info(code)
        if info is None:
            continue
        fst_dir = FST_CACHE_ROOT / code
        if fst_dir.exists():
            analyzer = find_analyzer_hfstol(fst_dir)
            if analyzer:
                installed.append({
                    "code": code,
                    "name": _lc.get_name(code) or code,
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
        print("  Neural metrics:")
        print("    ❌ unbabel-comet — Not installed")
        print("       COMET provides the best correlation with human quality")
        print("       judgments (WMT primary metric since 2022). Recommended")
        print("       for all evaluations. ~2.3 GB model downloads on first use.")
    print()

    # FST
    fst_ok = check_pyhfst_installed()
    fst_list = get_installed_fsts()
    if fst_ok:
        print(f"  Morphological validation:")
        print(f"    ✅ pyhfst       — HFST transducer runtime")
        if fst_list:
            for fst in fst_list:
                print(f"    ✅ {fst['code']:3s} — {fst['name']} ({fst['analyzer']})")
        else:
            print("       No FST transducers downloaded yet.")
            print("       Run `mt-eval test` on a supported language to auto-download.")
    else:
        print("  Morphological validation:")
        print("    ❌ pyhfst       — Not installed")
        print("       Required for FST-based morphological checking of")
        print("       polysynthetic languages (crk, sme, etc.).")
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
        print("       Install with: mt-eval setup --lang crk")
    print()

    # Available FSTs not yet installed
    from mt_eval_harness import language_cards as _lc
    installed_codes = {f["code"] for f in fst_list}
    available = []
    for code in _lc.get_all_codes():
        if code in installed_codes:
            continue
        info = _lc.get_fst_install_info(code)
        if info is not None:
            available.append((code, info))
    if available and fst_ok:
        print("  Available FSTs (auto-download on first eval):")
        for code, info in available:
            fmt = info.get("format", "")
            maturity = info.get("maturity", "")
            lang_name = _lc.get_name(code) or code
            status = ""
            if maturity == "stub":
                status = " (dev/stub — limited vocabulary)"
            elif fmt == "manual":
                status = " (manual install required)"
            elif fmt == "divvun":
                status = " (Divvun manager required)"
            print(f"    ○ {code:3s} — {lang_name}{status}")
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


def _pip_install(package_spec: str, description: str) -> bool:
    """Run pip install with user feedback.

    Args:
        package_spec: pip install argument (e.g. "unbabel-comet>=2.2")
        description: Human-readable name for display

    Returns:
        True if install succeeded, False otherwise
    """
    print(f"\n  Installing {description}...")
    print(f"  → pip install {package_spec}")
    pip_env = _pip_subprocess_env()
    if pip_env is not None:
        print("  (externally-managed python detected — installing to the "
              "user site)")
    print()

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package_spec],
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

    return _pip_install("unbabel-comet>=2.2", "COMET neural metric (unbabel-comet)")


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

def install_lang(lang_code: str, interactive: bool = True) -> bool:
    """Install eval pack for any language, driven by language card data.

    Reads the ``evalPack`` field from the language card and installs:
    1. Python dependencies (pip install)
    2. Post-install commands (e.g., spaCy model downloads)
    3. FST morphological analyzer files (if requiresFst is set)

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
    python_deps = pack.get("pythonDeps", {})
    post_install = pack.get("postInstall", [])
    requires_fst = pack.get("requiresFst", False)

    # Check what's already installed
    missing_deps = {}
    for import_name, pip_spec in python_deps.items():
        try:
            __import__(import_name)
        except ImportError:
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
            import subprocess as sp
            result = sp.run(
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
):
    """Run the interactive setup wizard.

    Args:
        install_all: Install everything without prompts
        comet_only: Install just COMET
        fst_only: Install just FST support
        lang_code: Install eval pack for a specific language (e.g., "crk")
        status_only: Just show current status
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
    """Prompt user to install COMET when it's missing during an eval.

    Called from tester.py when HAS_COMET is False. Instead of just
    printing "pip install unbabel-comet", we offer to do it right here.

    Returns:
        True if COMET was installed and is now available.
    """
    if not sys.stdin.isatty():
        # Non-interactive — just print the note
        print("  COMET: not installed. Install with: mt-eval setup --comet")
        return False

    print()
    print("  ┌──────────────────────────────────────────────────────────┐")
    print("  │  COMET Not Installed                                    │")
    print("  │                                                         │")
    print("  │  COMET is the WMT primary metric for MT evaluation.     │")
    print("  │  Your results will be more reliable with it.            │")
    print("  │                                                         │")
    print("  │  ~300 MB install + ~2.3 GB model download (first use)   │")
    print("  └──────────────────────────────────────────────────────────┘")
    print()

    try:
        answer = input("  Install COMET now? [Y/n]: ").strip().lower()
        if answer in ("n", "no"):
            print("  Continuing without COMET. You can install later: mt-eval setup --comet")
            return False
    except (EOFError, KeyboardInterrupt):
        print()
        return False

    success = _pip_install("unbabel-comet>=2.2", "COMET neural metric")

    if success:
        # Verify import works after install
        try:
            from comet import download_model  # noqa: F401
            return True
        except ImportError:
            print("  ⚠  Install succeeded but import failed. You may need to restart Python.")
            return False

    return False
