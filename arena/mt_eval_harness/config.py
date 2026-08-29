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
_REGISTRY_CACHE = Path.home() / ".cache" / "gds-mt-eval" / "registry.json"
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
        "Run `python arena/scripts/build_registry.py`, set MT_EVAL_DATA_ROOT, "
        "or check your network connection."
    )


# ---------------------------------------------------------------------------
# Eval pack dependency gate
# ---------------------------------------------------------------------------
#
# The eval pack gate prevents evaluation against a dataset whose target
# language requires tools that aren't installed. It reads requirements
# from the language card's `evalPack` field — no language-specific code.
#
# Adding eval pack support for a new language = editing ONE JSON file
# (the language card). The harness checks it generically.


def _check_eval_pack(dataset_entry: dict, assume_yes: bool = False) -> None:
    """Verify that eval pack dependencies for a dataset's target language
    are installed.

    Reads the target language from the dataset's ``language_pair.target``,
    looks up the language card, and checks its ``evalPack`` requirements.
    If dependencies are missing: with consent (``assume_yes``, CI=true, or
    MT_EVAL_AUTO_SETUP=1) they are auto-installed from the language card's
    declarations; otherwise a RuntimeError tells the user exactly which
    command to run.

    This is fully data-driven — the language card is the SSOT. No
    language-specific code exists in this function.
    """
    # Determine the target language from the dataset entry. Prefer the
    # registry's language_resolution stamp (Position 4 v2) — it strips
    # script subtags and follows retirements/variety pins, so eval packs
    # engage for e.g. a cmn-Hans-labeled corpus (base card cmn) instead of
    # silently skipping on a card-less tag.
    resolution = dataset_entry.get("language_resolution") or {}
    lang_pair = dataset_entry.get("language_pair", {})
    target_code = ((resolution.get("target") or {}).get("resolved")
                   or lang_pair.get("target"))
    if not target_code:
        return  # No target language declared — skip check

    # Look up the language card's eval pack requirements
    from mt_eval_harness.language_cards import get_eval_pack, get_name
    pack = get_eval_pack(target_code)
    if not pack:
        return  # No eval pack for this language — proceed

    missing = []

    # Check Python dependencies declared in the eval pack
    for import_name, pip_spec in pack.get("pythonDeps", {}).items():
        try:
            __import__(import_name)
        except ImportError:
            missing.append(f"{pip_spec} ({import_name})")

    # Check FST files if required
    if pack.get("requiresFst"):
        from mt_eval_harness.plugins.fst_installer import is_fst_installed
        if not is_fst_installed(target_code):
            lang_name = get_name(target_code) or target_code
            missing.append(f"FST morphological analyzer ({lang_name})")

    if not missing:
        return  # Everything installed — proceed

    dataset_id = dataset_entry["id"]
    lang_name = get_name(target_code) or target_code
    setup_cmd = f"mt-eval setup --lang {target_code}"
    missing_str = "\n".join(f"    ✗ {m}" for m in missing)

    # Automation path: with explicit consent (--yes, CI=true, or
    # MT_EVAL_AUTO_SETUP=1) install the eval pack now instead of failing —
    # FSTs, python deps, and post-install steps all come from the language
    # card (SSOT), exactly as `mt-eval setup --lang` would install them.
    # Consent is required because this downloads third-party tools (e.g.
    # AGPL GiellaLT FSTs) and pip-installs packages into the current env.
    auto = assume_yes or any(
        os.environ.get(var, "").lower() in ("1", "true", "yes")
        for var in ("CI", "MT_EVAL_AUTO_SETUP")
    )
    if auto:
        # FSTs that cannot be fetched programmatically (card format
        # 'manual', or Divvun-manager-only) must not hard-block automated
        # runs forever — the run proceeds WITHOUT fst_acceptance_rate and
        # the composite re-normalizes over the available metrics
        # (SCORING_SPEC §4.1); coverage is visibly reduced on the card.
        # A failed install of an AUTO-installable FST still hard-fails.
        if any(m.startswith("FST ") for m in missing):
            from mt_eval_harness.language_cards import get_fst_install_info
            info = get_fst_install_info(target_code) or {}
            if info.get("format") not in (
                "giellalt-nightly-apt", "legacy-zip", "divvun-macos-pkg"
            ):
                print(
                    f"  ⚠ FST for {lang_name} is not auto-installable "
                    f"(format {info.get('format', 'none')!r}); proceeding "
                    "WITHOUT fst_acceptance_rate — reduced metric coverage. "
                    f"Install manually via `{setup_cmd}` for full coverage."
                )
                missing = [m for m in missing if not m.startswith("FST ")]
                if not missing:
                    return
                # NOTE: install_lang below will still try (and fail) the
                # manual FST after installing the python deps; the re-check
                # at the top of this gate passes on the next run.
        print(f"  Eval pack for {lang_name} ({target_code}) missing; "
              "auto-installing (consent via --yes/CI/MT_EVAL_AUTO_SETUP):")
        for m in missing:
            print(f"    → {m}")
        from mt_eval_harness.setup_wizard import install_lang
        if install_lang(target_code, interactive=False):
            return
        print("  Auto-install failed; falling through to the manual "
              "instructions below.")

    raise RuntimeError(
        f"\n"
        f"  ┌──────────────────────────────────────────────────────────┐\n"
        f"  │  EVAL PACK REQUIRED: {lang_name:<36} │\n"
        f"  │                                                          │\n"
        f"  │  Dataset '{dataset_id}' targets {target_code.upper()} which requires     │\n"
        f"  │  evaluation tools that are not yet installed.             │\n"
        f"  └──────────────────────────────────────────────────────────┘\n"
        f"\n"
        f"  Missing:\n"
        f"{missing_str}\n"
        f"\n"
        f"  To install everything at once:\n"
        f"    {setup_cmd}\n"
    )




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
                    assume_yes: bool = False, skip_eval_pack: bool = False) -> Path:
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
        _check_eval_pack(match, assume_yes=assume_yes)

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
    cache_dir = Path.home() / ".cache" / "gds-mt-eval" / "datasets"
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
    """Format the dataset registry as a human-readable table.

    Returns:
        Formatted string with dataset info, suitable for terminal output.
    """
    registry = load_registry(registry_path)
    datasets = registry.get("datasets", [])

    if not datasets:
        return "  No datasets registered."

    # Column widths
    lines = [
        "",
        "  Available Evaluation Datasets:",
        "",
        f"  {'ID':25s} {'Name':35s} {'Pair':10s} {'Size':>5s} {'Avail':5s}",
        f"  {'-'*25} {'-'*35} {'-'*10} {'-'*5} {'-'*5}",
    ]

    monorepo_root = _PACKAGE_DIR.parent.parent

    for d in datasets:
        pair_info = d.get("language_pair", {})
        pair = f"{pair_info.get('source', '?')}→{pair_info.get('target', '?')}"

        # Check if the dataset is locally available
        local_path = d.get("local_path")
        avail = ""
        if local_path:
            resolved = monorepo_root / local_path
            avail = "✓" if resolved.exists() else "✗"
        elif d.get("url"):
            avail = "↓"  # downloadable

        lines.append(
            f"  {d['id']:25s} {d.get('name', ''):35s} {pair:10s} "
            f"{d.get('size', '?'):>5} {avail:5s}"
        )

    lines.append("")
    lines.append("  Avail: ✓ = local  ↓ = downloadable  ✗ = path not found  (blank) = private")
    lines.append("")
    lines.append("  Use: mt-eval run --corpus <dataset-id>       (resolves from registry)")
    lines.append("       mt-eval run --corpus <local_path.json>  (direct file path)")
    return "\n".join(lines)


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
# Model aliases — maps short names to OpenRouter model IDs
# ---------------------------------------------------------------------------
# Loaded from shared/model-aliases.json (shared with the CLI) so both
# tools accept the same short names. Falls back to a hardcoded dict
# when running outside the monorepo (standalone pip install).
#
# You can always pass a full OpenRouter model ID directly
# (e.g. "anthropic/claude-sonnet-4"). The alias file is just convenience.

def _load_model_aliases() -> dict[str, str]:
    """Load model aliases from the shared JSON file.

    Search order:
      1. shared/model-aliases.json relative to the monorepo root
         (detected by walking up from this file's directory)
      2. Hardcoded fallback for standalone installs

    Returns:
        Dict mapping short names → full OpenRouter model IDs.
    """
    # Walk up from this package to find the monorepo shared/ directory
    check = _PACKAGE_DIR
    for _ in range(6):
        candidate = check / "shared" / "model-aliases.json"
        if candidate.exists():
            try:
                aliases = json.loads(candidate.read_text(encoding="utf-8"))
                # Strip non-alias keys (like _comment)
                return {k: v for k, v in aliases.items() if not k.startswith("_")}
            except Exception as e:
                logger.debug(
                    "Failed to load model aliases from %s: %s", candidate, e
                )
                break
        check = check.parent

    # Standalone fallback: EXACTLY mirror shared/model-aliases.json (the SSOT) —
    # nothing more. We do NOT invent extra aliases/slugs that aren't in the SSOT
    # (a former 17-entry superset silently diverged and shipped slugs the SSOT
    # never declared). Any model can always be named by its full OpenRouter ID,
    # and fuzzy_resolve_model() handles vendor-prefixed names; these four are
    # just the documented convenience shorthands. Keep in sync with the SSOT.
    return {
        "gemini-flash":  "google/gemini-3.5-flash",
        "gemini-pro":    "google/gemini-3.1-pro-preview",
        "claude-sonnet": "anthropic/claude-sonnet-4",
        "gpt":           "openai/gpt-5.5",
    }


MODEL_REGISTRY: dict[str, str] = _load_model_aliases()


def fuzzy_resolve_model(name: str) -> str | None:
    """Try to resolve a partial model name to a full OpenRouter slug.

    Resolution chain:
        1. Exact match in MODEL_REGISTRY → return the full slug
        2. Name already contains "/" → assume it's a full slug, return as-is
        3. Check known vendor prefixes (anthropic, google, openai, etc.)
           and try "{vendor}/{name}" as a plausible OpenRouter slug
        4. Check if the name is a substring of any registry value
           (handles e.g. 'fable-5' matching 'anthropic/claude-fable-5')

    This avoids requiring a live OpenRouter API call for common cases.
    Returns None if no match can be inferred.
    """
    # 1. Exact registry match
    if name in MODEL_REGISTRY:
        return MODEL_REGISTRY[name]

    # 2. Already a full slug (contains vendor prefix)
    if "/" in name:
        return name

    # 3. Known vendor prefix heuristics
    # Map common model name prefixes → vendor namespace on OpenRouter
    _VENDOR_PREFIXES = {
        "claude":    "anthropic",
        "gemini":    "google",
        "gpt":       "openai",
        "o1":        "openai",
        "o3":        "openai",
        "o4":        "openai",
        "deepseek":  "deepseek",
        "qwen":      "qwen",
        "llama":     "meta-llama",
        "mistral":   "mistralai",
        "command":   "cohere",
        "glm":       "z-ai",
    }

    name_lower = name.lower()
    for prefix, vendor in _VENDOR_PREFIXES.items():
        if name_lower.startswith(prefix):
            candidate = f"{vendor}/{name}"
            logger.info(
                "Fuzzy model match: '%s' → '%s' (inferred from '%s' prefix)",
                name, candidate, prefix,
            )
            return candidate

    # 4. Substring match against registry values
    # Handles cases like 'fable-5' appearing in 'anthropic/claude-fable-5'
    for alias, full_slug in MODEL_REGISTRY.items():
        if name_lower in full_slug.lower():
            logger.info(
                "Fuzzy model match: '%s' → '%s' (substring of '%s')",
                name, full_slug, alias,
            )
            return full_slug

    return None


DEFAULT_MODEL = "gemini-pro"

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
    model: str = DEFAULT_MODEL  # Short name, resolved via MODEL_REGISTRY
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
    # the upstream data license non-interactively.
    assume_yes: bool = False
    # When True the CLI was invoked with --publish: after a successful run the
    # scored report is published to the leaderboard non-interactively (the
    # one-step run+publish path), instead of the interactive "Publish? [y/N]"
    # prompt. Content-safety gating is unchanged (see publish.publish_to_supabase).
    auto_publish: bool = False

    # --- Method plugin ---
    # Path to a method plugin directory containing method.json + Python
    # module. When set, the harness delegates translation to the plugin
    # instead of using the built-in LLM caller. The method is a black box:
    # source text in, translation out. The harness just scores the output.
    method_path: str | None = None
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

    # --- Champollion config interop ---
    # Enables config interchangeability with champollion production CLI.
    # When set, --prompt champollion uses the config to build production-
    # identical prompts with register, gender guidance, and promptContext.
    champollion_config_path: str | None = None   # --champollion-config path
    champollion_cards_dir: str | None = None     # --champollion-cards-dir path
    target_lang_code: str = ""               # --target-lang-code (e.g., "fr")

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

    def validate(self, prompt_versions: list[str] | None = None) -> list[str]:
        """Validate configuration, return list of error messages.

        Args:
            prompt_versions: Available prompt version names (built-in +
                registered plugins). If None, only validates "naive" and "custom".
        """
        errors = []

        # Model resolution — allow short names, full IDs, and fuzzy matches.
        # Full IDs (containing "/") pass through. Short names are looked up
        # in MODEL_REGISTRY. Unrecognized names get fuzzy-matched via
        # vendor prefix heuristics before erroring.
        if self.model not in MODEL_REGISTRY and "/" not in self.model:
            resolved = fuzzy_resolve_model(self.model)
            if resolved:
                import sys
                print(
                    f"  ℹ Resolved '{self.model}' → '{resolved}' (fuzzy match)",
                    file=sys.stderr,
                )
                self.model = resolved
            else:
                errors.append(
                    f"Unknown model '{self.model}'. "
                    f"Available: {', '.join(sorted(MODEL_REGISTRY.keys()))}. "
                    f"Or pass a full OpenRouter model ID (e.g. 'anthropic/claude-sonnet-4')."
                )

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

        # Champollion config validation
        if self.prompt_version == "champollion" or self.champollion_config_path:
            if self.champollion_config_path and not Path(self.champollion_config_path).exists():
                errors.append(f"Champollion config not found: {self.champollion_config_path}")
            if self.champollion_config_path and not self.target_lang_code:
                errors.append(
                    "--champollion-config requires --target-lang-code. "
                    "Provide the BCP-47 code for the target language (e.g., 'fr', 'de', 'crk')."
                )
            if self.prompt_version == "champollion" and not self.champollion_config_path:
                errors.append(
                    "--prompt champollion requires --champollion-config. "
                    "Provide the path to your champollion.config.json."
                )

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
                    skip_eval_pack=self.dry_run)
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
        # Skip in dry-run: a pre-flight validates config + corpus, not the
        # (AGPL, auto-installed) scoring toolchain — those are gated at real
        # run time. Mirrors the registry-ID branch above (skip_eval_pack).
        target_code = self.target_lang_code
        if not target_code and self.target_lang:
            from mt_eval_harness.language_cards import resolve_name
            target_code = resolve_name(self.target_lang) or ""
        if target_code and not self.dry_run:
            try:
                _check_eval_pack(
                    {"id": Path(self.corpus_path).stem if self.corpus_path
                           else "(inline)",
                     "language_pair": {"target": target_code}},
                    assume_yes=self.assume_yes,
                )
            except RuntimeError as e:
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
        """Resolve short model name to full OpenRouter model ID."""
        return MODEL_REGISTRY.get(self.model, self.model)

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
        ("gemini-pro"). Without this, the default LLM slug leaked into the
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
