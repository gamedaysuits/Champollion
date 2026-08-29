"""
Corpus Fetch — fetch-from-source resolution for missing corpora.

Champollion does not host third-party corpora in git. A missing corpus
file can instead be rebuilt locally from a pinned upstream source,
described in one of two places:

1. A **corpora card** (``cli/shared/corpora-cards/``) whose ``source``
   block records the upstream repo and builder:

    "source": {
        "repo_url": "https://github.com/EdTeKLA/IndigenousLanguages_Corpora",
        "ref":      "<commit sha>",
        "builder":  "edtekla",
        "sha256":   "<sha256 of the built corpus file>",
        "license":  "CC-BY-NC-SA-4.0",
        "license_url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    }

2. A **registry dataset entry** (``arena/datasets/registry.json``) with
   ``access: "fetch-from-source"`` and a ``source_export`` block pinning
   the upstream export URL, its sha256, and the extraction recipe (the
   Tatoeba mesh corpora use this — see
   ``mt_eval_harness.corpus_build.adapters.tatoeba_challenge_adapter``):

    "source_export": {
        "builder": "tatoeba-challenge",
        "url":     "https://object.pouta.csc.fi/Tatoeba-Challenge-devtest/test-v2023-09-26.tar",
        "sha256":  "<sha256 of the export archive>",
        "recipe":  {"split": "test", "seed": 42, ...},
        "license": "CC-BY-2.0",
        "license_url": "https://creativecommons.org/licenses/by/2.0/"
    }

When the harness is asked to load a corpus whose file is missing, this
module:

    1. Matches the missing path against corpora cards first (matching
       each card's ``dev.dataFile`` / ``test.dataFile``), then against
       registry ``fetch-from-source`` entries (matching ``path``).
    2. Asks the user to confirm the upstream license and download
       (``--yes`` / ``assume_yes`` / ``CI=true`` skip the prompt; a
       non-interactive stdin without those flags is an error, never a
       hang).
    3. Runs the declared builder (from ``arena/scripts/corpora-builder``)
       to download from the upstream source and rebuild the corpus
       deterministically into the gitignored cache
       ``arena/datasets/.cache/``.
    4. Verifies the build against the pinned ``sha256`` when present.

The builders themselves live in the corpora-builder package so that the
download/parse logic has exactly one home.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)

_PACKAGE_DIR = Path(__file__).resolve().parent          # mt_eval_harness/
_ARENA_DIR = _PACKAGE_DIR.parent                        # arena/
_MONOREPO_ROOT = _ARENA_DIR.parent                      # Champollion/

def _resolve_cache_dir() -> Path:
    """Where fetched/rebuilt corpora are cached.

    The old value (``_ARENA_DIR / "datasets" / ".cache"``) is correct in the
    monorepo but resolves to ``site-packages/datasets/.cache`` for a standalone
    ``pip install`` — which is read-only on many installs (system Python, pipx,
    containers) and is wiped on every upgrade. So:

      1. ``MT_EVAL_DATA_ROOT`` override → ``<root>/datasets/.cache`` (CI/staging).
      2. Monorepo (a real ``arena/datasets/registry.json`` sits beside us) →
         ``arena/datasets/.cache`` (gitignored, the established location).
      3. Standalone install → ``~/.cache/gds-mt-eval/datasets/.cache`` — a
         user-writable, persistent dir, NEVER inside site-packages. This matches
         config.py's URL-download cache (``~/.cache/gds-mt-eval/datasets``), so
         both corpus-cache mechanisms live under one user tree (SSOT).
    """
    env_root = os.environ.get("MT_EVAL_DATA_ROOT")
    if env_root:
        return Path(env_root).expanduser() / "datasets" / ".cache"
    if (_ARENA_DIR / "datasets" / "registry.json").is_file():
        return _ARENA_DIR / "datasets" / ".cache"
    return Path.home() / ".cache" / "gds-mt-eval" / "datasets" / ".cache"


#: Gitignored build cache for fetched corpora (user-dir on standalone installs).
CACHE_DIR = _resolve_cache_dir()

#: Dataset registry — fetch-from-source entries carry a `source_export`
#: block describing how to rebuild their corpus from the upstream export.
REGISTRY_PATH = _ARENA_DIR / "datasets" / "registry.json"


# ---------------------------------------------------------------------------
# Corpora-cards directory resolution
# ---------------------------------------------------------------------------

def find_corpora_cards_dir() -> Path | None:
    """Auto-detect the corpora cards directory.

    Mirrors ``language_cards._find_cards_dir`` (the established
    resolution style for shared card directories):

        1. Relative to this file: <monorepo>/cli/shared/corpora-cards/
        2. Walk up from CWD checking cli/shared/corpora-cards/ and
           shared/corpora-cards/
        3. npm install fallback under node_modules/champollion/

    Returns None when not found.
    """
    candidate = _MONOREPO_ROOT / "cli" / "shared" / "corpora-cards"
    if candidate.is_dir():
        return candidate

    check = Path.cwd()
    for _ in range(10):
        for sub in [
            check / "cli" / "shared" / "corpora-cards",
            check / "shared" / "corpora-cards",
        ]:
            if sub.is_dir():
                return sub
        check = check.parent

    npm_path = Path.cwd() / "node_modules" / "champollion" / "shared" / "corpora-cards"
    if npm_path.is_dir():
        return npm_path

    return None


# ---------------------------------------------------------------------------
# Card matching
# ---------------------------------------------------------------------------

def _card_data_files(card: dict[str, Any]) -> list[str]:
    """Collect the dataFile paths a card declares (dev and public test)."""
    files = []
    for split in ("dev", "test"):
        block = card.get(split)
        if isinstance(block, dict) and block.get("dataFile"):
            files.append(block["dataFile"])
    return files


def _is_fetchable(card: dict[str, Any]) -> bool:
    """A card is fetchable when its source block declares repo + builder."""
    source = card.get("source")
    return (
        isinstance(source, dict)
        and bool(source.get("repo_url"))
        and bool(source.get("builder"))
    )


def find_card_for_corpus(
    corpus_path: str | Path,
    cards_dir: Path | None = None,
) -> tuple[dict[str, Any], str] | None:
    """Find a fetchable corpora card whose dataFile matches a corpus path.

    Matching is suffix-based: the card's ``dataFile`` is relative to
    ``arena/datasets/`` (e.g. ``curated/eng-crk-dev-v1.json``), while
    callers pass arbitrary absolute/relative paths. A card matches when
    the requested path ends with the dataFile path, or (fallback) shares
    its filename.

    Returns:
        (card, data_file) for the first match, or None.
    """
    cards_dir = cards_dir or find_corpora_cards_dir()
    if cards_dir is None:
        return None

    requested = Path(corpus_path)
    requested_posix = requested.as_posix()

    filename_match: tuple[dict[str, Any], str] | None = None
    for card_file in sorted(cards_dir.glob("*.json")):
        try:
            card = json.loads(card_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Skipping unreadable corpora card %s: %s",
                           card_file, exc)
            continue
        if not _is_fetchable(card):
            continue
        for data_file in _card_data_files(card):
            if requested_posix.endswith(Path(data_file).as_posix()):
                return card, data_file
            if filename_match is None and requested.name == Path(data_file).name:
                filename_match = (card, data_file)

    return filename_match


# ---------------------------------------------------------------------------
# Builder registry
# ---------------------------------------------------------------------------

# HISTORY (2026-08-27): corpus rebuilds used to delegate to the proprietary
# corpora-builder via sys.path insertion here, which meant a pip-installed
# harness or a public-repo clone could browse the queue but rebuild nothing
# — with 5,595 of 5,602 registry corpora fetch-from-source and corpus
# content never tracked, the public contributor lane did not work. Founder
# decision: the minimal build primitives (adapters, schema, licensing,
# sampling) now ship WITH the harness as mt_eval_harness.corpus_build; the
# intake/probe/recipe-authoring tooling remains private. See
# docs PRE_REVIEW_HARDENING_2026-08-27 in the internal planning set.

def _build_edtekla(card: dict[str, Any], dest: Path, *, assume_yes: bool) -> Path:
    """Builder for the 'edtekla' adapter id."""
    from mt_eval_harness.corpus_build.adapters import edtekla_adapter

    source = card["source"]
    return edtekla_adapter.build_corpus_file(
        dest,
        cache_dir=CACHE_DIR / "edtekla",
        ref=source.get("ref", edtekla_adapter.DEFAULT_REF),
        auto_yes=assume_yes,
    )


def _build_tatoeba_challenge_from_card(
    card: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'tatoeba-challenge' when invoked from a corpora card.

    Corpora cards store the language pair in ``card["pair"]`` and build
    params in ``card["source"]["recipe"]``, whereas registry entries use
    ``entry["language_pair"]`` and ``entry["source_export"]["recipe"]``.
    This wrapper translates between the two shapes so the underlying
    ``tatoeba_challenge_adapter`` can be used in both code paths.
    """
    from mt_eval_harness.corpus_build.adapters import tatoeba_challenge_adapter

    source = card["source"]
    pair = card["pair"]
    return tatoeba_challenge_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "tatoeba-challenge",
        recipe=source.get("recipe"),
        tar_url=source.get("repo_url", tatoeba_challenge_adapter.TEST_TAR_URL),
        # A card's source.sha256 is the BUILT-CORPUS hash (verified after the
        # build by fetch_corpus_from_card) — NOT the archive hash. Passing it
        # here made ensure_test_tar verify the 169 MB archive against a
        # per-corpus hash: it ALWAYS failed, and on failure the archive is
        # deleted and re-downloaded — so every corpus re-pulled the full
        # export and no card-based fetch could ever succeed. The archive hash
        # is the adapter's pinned TEST_TAR_SHA256; a card may override it with
        # an explicit source.archive_sha256 if a different release is pinned.
        tar_sha256=source.get(
            "archive_sha256", tatoeba_challenge_adapter.TEST_TAR_SHA256,
        ),
        auto_yes=assume_yes,
    )


def _build_globalvoices_parallel(
    card: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for the 'globalvoices-parallel' source.builder id.

    GlobalVoices cards pin the OPUS export base + tail-split recipe inline
    in ``source`` and the pair in ``pair``. The adapter reproduces the
    deterministic tail split; the card's ``dev.size`` is enforced so a
    drifted upstream can't silently serve a different corpus.
    """
    from mt_eval_harness.corpus_build.adapters import globalvoices_adapter

    pair = card["pair"]
    source = card["source"]
    return globalvoices_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "globalvoices",
        recipe=source.get("recipe"),
        expected_size=(card.get("dev") or {}).get("size"),
        auto_yes=assume_yes,
    )


def _build_tatoeba_opus_from_card(
    card: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'tatoeba-opus' when invoked from a corpora card.

    OPUS-Tatoeba cards pin a per-pair moses archive (URL + ``archive_sha256``)
    and the build recipe inline in ``source``, with the pair in ``pair``. The
    adapter downloads the small per-pair zip, verifies its sha, and rebuilds
    the dev corpus deterministically; the card's ``dev.size`` is enforced so a
    drifted upstream can't silently serve a different corpus.
    """
    from mt_eval_harness.corpus_build.adapters import tatoeba_opus_adapter

    source = card["source"]
    pair = card["pair"]
    return tatoeba_opus_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "tatoeba-opus",
        recipe=source.get("recipe"),
        archive_sha256=source.get("archive_sha256"),
        expected_size=(card.get("dev") or {}).get("size"),
        auto_yes=assume_yes,
    )


#: builder id (corpora-card source.builder) → build callable.
BUILDERS: dict[str, Callable[..., Path]] = {
    "edtekla": _build_edtekla,
    "tatoeba-challenge": _build_tatoeba_challenge_from_card,
    "tatoeba-opus": _build_tatoeba_opus_from_card,
    "globalvoices-parallel": _build_globalvoices_parallel,
}


# ---------------------------------------------------------------------------
# Registry-based fetch-from-source (source_export entries)
# ---------------------------------------------------------------------------

def find_registry_export_for_corpus(
    corpus_path: str | Path,
    registry_path: Path | None = None,
) -> dict[str, Any] | None:
    """Find a fetch-from-source registry entry matching a corpus path.

    Same matching semantics as ``find_card_for_corpus``: the registry's
    ``path`` is relative to ``arena/datasets/`` while callers pass
    arbitrary paths, so an entry matches when the requested path ends
    with it (or, as a fallback, shares its filename).

    With no explicit ``registry_path`` the layered resolver
    (``config.load_registry``: local → bundled → remote) is used, so this
    works for a standalone install where no registry file sits at the
    in-repo path — that's what lets a ``pip install``ed harness fetch.
    """
    if registry_path is None:
        try:
            from mt_eval_harness.config import load_registry
            registry = load_registry()
        except (FileNotFoundError, OSError, json.JSONDecodeError, ValueError) as exc:
            logger.warning("Cannot resolve registry for fetch: %s", exc)
            return None
    else:
        if not Path(registry_path).is_file():
            return None
        try:
            registry = json.loads(
                Path(registry_path).read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Cannot read registry %s: %s", registry_path, exc)
            return None

    requested = Path(corpus_path)
    requested_posix = requested.as_posix()

    filename_match: dict[str, Any] | None = None
    for entry in registry.get("datasets", []):
        if (entry.get("access") or "").lower() != "fetch-from-source":
            continue
        export = entry.get("source_export")
        if not isinstance(export, dict) or not export.get("builder"):
            continue
        rel = entry.get("path")
        if not rel:
            continue
        if requested_posix.endswith(Path(rel).as_posix()):
            return entry
        if filename_match is None and requested.name == Path(rel).name:
            filename_match = entry

    return filename_match


def _build_tatoeba_challenge(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for the 'tatoeba-challenge' source_export builder id."""
    from mt_eval_harness.corpus_build.adapters import tatoeba_challenge_adapter

    export = entry["source_export"]
    lang_pair = entry["language_pair"]
    return tatoeba_challenge_adapter.build_corpus_file(
        dest,
        source_lang=lang_pair["source"],
        target_lang=lang_pair["target"],
        cache_dir=CACHE_DIR / "tatoeba-challenge",
        recipe=export.get("recipe"),
        tar_url=export.get("url", tatoeba_challenge_adapter.TEST_TAR_URL),
        tar_sha256=export.get(
            "sha256", tatoeba_challenge_adapter.TEST_TAR_SHA256,
        ),
        auto_yes=assume_yes,
    )


# ---------------------------------------------------------------------------
# FLORES / NTREX parallel-text builders
# ---------------------------------------------------------------------------
# These handle multiway registry entries generated by expand_multiway_card().
# Each entry has source_codes.source / source_codes.target containing the
# original file-level codes, and a source_export with the repo URL, the
# pinned commit revision, and the file pattern. The NTREX builder fetches
# the two aligned sentence files at the pin (raw.githubusercontent.com — no
# clone, no moving HEAD) and pairs them into a harness-json corpus file;
# FLORES+ has its own gated-HF builder below.

def _load_code_bridge() -> dict[str, Any]:
    """Load the SSOT code bridge for reverse-mapping ISO → file codes."""
    bridge_path = _ARENA_DIR.parent / "cli" / "shared" / "code-bridge.json"
    if bridge_path.exists():
        return json.loads(bridge_path.read_text(encoding="utf-8"))
    return {}


def _iso_to_flores_file_code(iso_code: str) -> str:
    """Map a project ISO 639-3 code to a FLORES+ file code.

    FLORES files use {iso639-3}_{script} format. Since the multiway card
    stores ISO codes (script stripped), we need to add the script back.
    The most common script for each language is used.

    For the two special cases where the ISO base differs:
        cmn-Hans → zho_Hans, cmn-Hant → zho_Hant
    """
    # Handle cmn variants explicitly
    if iso_code == "cmn-Hans":
        return "zho_Hans"
    if iso_code == "cmn-Hant":
        return "zho_Hant"
    if iso_code == "cmn":
        return "zho_Hans"  # default to simplified

    # For all other codes, the FLORES file code is {iso}_{default_script}.
    # We use a small lookup for common non-Latin scripts; everything else
    # defaults to Latn.
    _SCRIPT_MAP: dict[str, str] = {
        "amh": "Ethi", "arb": "Arab", "asm": "Beng", "ben": "Beng",
        "bod": "Tibt", "bul": "Cyrl", "ell": "Grek", "guj": "Gujr",
        "heb": "Hebr", "hin": "Deva", "hye": "Armn", "jpn": "Jpan",
        "kan": "Knda", "kas": "Arab", "kat": "Geor", "khm": "Khmr",
        "kor": "Hang", "lao": "Laoo", "mal": "Mlym", "mar": "Deva",
        "mni": "Beng", "mya": "Mymr", "npi": "Deva", "ory": "Orya",
        "pan": "Guru", "pes": "Arab", "prs": "Arab", "pbt": "Arab",
        "rus": "Cyrl", "san": "Deva", "sat": "Olck", "sin": "Sinh",
        "snd": "Arab", "srp": "Cyrl", "tam": "Taml", "tel": "Telu",
        "tha": "Thai", "tir": "Ethi", "uig": "Arab", "ukr": "Cyrl",
        "urd": "Arab", "ydd": "Hebr", "yue": "Hant",
        # Additional scripts for multi-script languages
        "acm": "Arab", "acq": "Arab", "aeb": "Arab", "ajp": "Arab",
        "apc": "Arab", "ars": "Arab", "ary": "Arab", "arz": "Arab",
        "azb": "Arab", "bak": "Cyrl", "bel": "Cyrl", "bho": "Deva",
        "ckb": "Arab", "crh": "Latn", "dzo": "Tibt", "fuv": "Latn",
        "gaz": "Latn", "grn": "Latn", "hne": "Deva", "khk": "Cyrl",
        "kir": "Cyrl", "kmr": "Latn", "knc": "Arab", "mag": "Deva",
        "mai": "Deva", "mkd": "Cyrl", "awa": "Deva", "nus": "Latn",
        "plt": "Latn", "shn": "Mymr", "tat": "Cyrl", "tgk": "Cyrl",
        "tuk": "Latn", "uzb": "Latn",
    }
    script = _SCRIPT_MAP.get(iso_code, "Latn")
    return f"{iso_code}_{script}"


def _iso_to_ntrex_file_code(iso_code: str) -> str:
    """Map a project ISO 639-3 code to an NTREX repo filename code.

    NTREX uses macrolanguage codes in some filenames. The code bridge's
    ntrex_reverse section handles the mapping.

    English and Chinese ship upstream only as regional variants
    (eng-US/eng-GB/eng-IN, zho-CN/zho-TW — per the pinned commit's file
    listing; the previously emitted eng/zho-Hans names never existed there).
    Default to eng-US and zho-CN (Simplified), mirroring the FLORES mapper's
    zho_Hans default.
    """
    bridge = _load_code_bridge()
    reverse = bridge.get("ntrex_reverse", {})

    if iso_code in ("cmn", "cmn-Hans"):
        return "zho-CN"
    if iso_code == "cmn-Hant":
        return "zho-TW"
    if iso_code == "eng":
        return "eng-US"

    return reverse.get(iso_code, iso_code)


#: Canonical NTREX reference-file layout — fallback for registry entries
#: built before the card carried file_pattern.
_NTREX_FILE_PATTERN = "NTREX-128/newstest2019-ref.{lang_code}.txt"


def _fetch_ntrex_ref_file(
    repo_url: str, revision: str, rel_path: str, cache_dir: Path,
) -> Path:
    """Fetch one NTREX reference file at a pinned commit (cached by revision).

    Files come from raw.githubusercontent.com at the immutable ``revision``
    from the card's download.revision — byte-stable, no clone, no moving
    HEAD. 404 → the language file code is wrong or absent upstream.
    """
    import urllib.error
    import urllib.request

    owner_repo = (
        repo_url.split("github.com/", 1)[-1].removesuffix(".git").strip("/")
    )
    cache_path = cache_dir / revision / rel_path
    if not cache_path.is_file():
        url = f"https://raw.githubusercontent.com/{owner_repo}/{revision}/{rel_path}"
        logger.info("Fetching NTREX %s (rev %s)", rel_path, revision[:12])
        try:
            with urllib.request.urlopen(url, timeout=120) as resp:
                data = resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise FileNotFoundError(
                    f"NTREX file not found: {rel_path} at revision {revision} "
                    f"— the language file code is wrong or the file is "
                    f"absent upstream."
                ) from exc
            raise
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(data)
    return cache_path


# ---------------------------------------------------------------------------
# FLORES+ — gated HuggingFace dataset (openlanguagedata/flores_plus)
# ---------------------------------------------------------------------------
# FLORES+ moved off the old facebookresearch git repo (flores200/ tree) to the
# gated HF dataset openlanguagedata/flores_plus, which ships one JSONL per
# language under dev/ and devtest/ — one sentence per line, each line a JSON
# object with an integer ``id`` (0..N-1) and a ``text`` field. The builder
# fetches the two language files for a pair, pins an immutable HF commit
# ``revision`` so rebuilds are byte-stable (the basis of the per-pair sha pin),
# pairs sentences by ``id``, and writes a harness-json corpus. The OLD git-clone
# path never worked for this dataset (the repo now holds only a README), which
# is why every flores entry shipped sha256=null and catalogue-only.

_FLORES_HF_REPO = "openlanguagedata/flores_plus"


def _hf_token(token_env: str | None = None) -> str | None:
    """Resolve a HuggingFace access token from the environment (gated fetch)."""
    candidates = [token_env] if token_env else []
    candidates += ["HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACEHUB_API_TOKEN"]
    for var in candidates:
        if not var:
            continue
        val = os.environ.get(var)
        if val and val.strip():
            return val.strip()
    return None


def _fetch_flores_lang_file(
    file_code: str, segment: str, revision: str | None,
    token: str | None, cache_dir: Path,
) -> dict[int, str]:
    """Fetch one FLORES+ language JSONL (cached by revision); return {id: text}.

    Raises a loud, actionable error when the dataset's gate blocks the fetch
    (HTTP 401/403 → accept terms + set $HF_TOKEN) or the file is missing
    (404 → wrong language file code).
    """
    import urllib.error
    import urllib.request

    rev = revision or "main"
    rel = f"{segment}/{file_code}.jsonl"
    cache_path = cache_dir / rev / rel
    if not cache_path.is_file():
        url = f"https://huggingface.co/datasets/{_FLORES_HF_REPO}/resolve/{rev}/{rel}"
        req = urllib.request.Request(url)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        logger.info("Fetching FLORES+ %s (rev %s)", rel, rev[:12])
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                raise RuntimeError(
                    f"FLORES+ ({_FLORES_HF_REPO}) is a GATED HuggingFace dataset. "
                    f"Accept its terms at https://huggingface.co/datasets/"
                    f"{_FLORES_HF_REPO} and export an HF access token as $HF_TOKEN "
                    f"(got HTTP {exc.code} fetching '{file_code}')."
                ) from exc
            if exc.code == 404:
                raise FileNotFoundError(
                    f"FLORES+ file not found: {rel} at revision {rev} — the "
                    f"language file code '{file_code}' is wrong or absent upstream."
                ) from exc
            raise
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(data)

    texts: dict[int, str] = {}
    for line in cache_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        texts[int(obj["id"])] = obj.get("text", "")
    return texts


def _flores_file_code(iso: str, source_code: str | None) -> str:
    """Resolve the FLORES+ file stem for a pair side.

    Prefers the explicit FLORES stem carried on the registry entry's
    ``source_codes`` (e.g. ``fao_Latn``, ``quy_Latn`` — what the curated subset
    pins); falls back to reconstructing ``{iso}_{script}`` from the ISO code for
    legacy entries that stored bare ISO codes.
    """
    code = source_code or iso
    if "_" in str(code):
        return str(code)
    return _iso_to_flores_file_code(iso)


def _build_flores_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'flores-parallel' registry entries (gated HF flores_plus).

    Fetches the source + target FLORES+ language files, pairs them by sentence
    id, and writes a deterministic harness-json corpus. Deterministic output
    (sorted ids, fixed serialization, revision-pinned source) is what makes the
    per-pair ``sha256`` reproducible and verifiable.
    """
    export = entry.get("source_export") or {}
    lang_pair = entry["language_pair"]
    src_iso = lang_pair["source"]
    tgt_iso = lang_pair["target"]

    codes = entry.get("source_codes") or {}
    src_code = _flores_file_code(src_iso, codes.get("source"))
    tgt_code = _flores_file_code(tgt_iso, codes.get("target"))

    segment = export.get("segment", "devtest")
    revision = export.get("revision")
    token = _hf_token(export.get("token_env"))
    cache_dir = CACHE_DIR / "flores_plus"

    src_texts = _fetch_flores_lang_file(src_code, segment, revision, token, cache_dir)
    tgt_texts = _fetch_flores_lang_file(tgt_code, segment, revision, token, cache_dir)

    # Pair by sentence id (FLORES is line-aligned across every language).
    entries = []
    for sid in sorted(set(src_texts) & set(tgt_texts)):
        s = (src_texts[sid] or "").strip()
        t = (tgt_texts[sid] or "").strip()
        if not s or not t:
            continue
        entries.append({"source": s, "target": t, "id": str(sid)})

    corpus = {
        "source_lang": src_iso,
        "target_lang": tgt_iso,
        "entry_count": len(entries),
        "domain": "news",
        "source_dataset": f"flores-{segment}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info("Built FLORES+ corpus: %s → %s (%d entries) at %s",
                src_iso, tgt_iso, len(entries), dest)
    return dest


def _build_ntrex_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'ntrex-parallel' registry entries.

    NTREX-128 is multi-way line-aligned: one reference file per language,
    pairable by line number. The two files for the pair are fetched at the
    card's pinned commit (``source_export.revision``) and paired into a
    deterministic harness-json corpus. NTREX stays catalogue-only (HIGH
    contamination); the pin is a determinism fix, not a promotion.
    """
    export = entry["source_export"]
    lang_pair = entry["language_pair"]
    src_iso = lang_pair["source"]
    tgt_iso = lang_pair["target"]

    revision = export.get("revision")
    if not revision:
        raise RuntimeError(
            f"NTREX entry '{entry.get('id', '?')}' has no "
            f"source_export.revision — an unpinned fetch would read a moving "
            f"HEAD and cannot be reproduced. Rebuild the registry from the "
            f"corpora cards (eval-ntrex-test-v1 pins the commit on "
            f"download.revision)."
        )

    src_code = _iso_to_ntrex_file_code(src_iso)
    tgt_code = _iso_to_ntrex_file_code(tgt_iso)
    pattern = export.get("file_pattern") or _NTREX_FILE_PATTERN
    cache_dir = CACHE_DIR / "ntrex"

    src_file = _fetch_ntrex_ref_file(
        export["url"], revision, pattern.format(lang_code=src_code), cache_dir)
    tgt_file = _fetch_ntrex_ref_file(
        export["url"], revision, pattern.format(lang_code=tgt_code), cache_dir)

    # Read aligned sentences and pair by line number
    src_lines = src_file.read_text(encoding="utf-8").strip().splitlines()
    tgt_lines = tgt_file.read_text(encoding="utf-8").strip().splitlines()

    if len(src_lines) != len(tgt_lines):
        raise ValueError(
            f"Line count mismatch: {src_file.name} has {len(src_lines)} lines, "
            f"{tgt_file.name} has {len(tgt_lines)} lines"
        )

    entries = []
    for i, (src_text, tgt_text) in enumerate(zip(src_lines, tgt_lines), 1):
        src_text = src_text.strip()
        tgt_text = tgt_text.strip()
        if not src_text or not tgt_text:
            continue
        entries.append({
            "source": src_text,
            "target": tgt_text,
            "id": str(i),
        })

    corpus = {
        "source_lang": src_iso,
        "target_lang": tgt_iso,
        "entry_count": len(entries),
        "domain": "news",
        "source_dataset": f"ntrex-{export.get('segment', 'test')}",
        "entries": entries,
    }

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info("Built NTREX corpus: %s → %s (%d entries) at %s",
                src_iso, tgt_iso, len(entries), dest)
    return dest


def _build_globalvoices_parallel_entry(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'globalvoices-parallel' registry source_export entries.

    The registry path — used when no corpora card is present, e.g. a third
    party running the harness from the public mirror (which ships the
    registry but not the cli/ corpora cards). The registry entry carries the
    pair, the OPUS export URL, and the tail-split recipe, so the adapter has
    everything it needs without a card.
    """
    from mt_eval_harness.corpus_build.adapters import globalvoices_adapter

    export = entry["source_export"]
    lang_pair = entry["language_pair"]
    return globalvoices_adapter.build_corpus_file(
        dest,
        source_lang=lang_pair["source"],
        target_lang=lang_pair["target"],
        cache_dir=CACHE_DIR / "globalvoices",
        recipe=export.get("recipe"),
        expected_size=entry.get("size"),
        auto_yes=assume_yes,
    )


def _build_tatoeba_opus(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'tatoeba-opus' registry source_export entries.

    The registry path — used when no corpora card is present (e.g. a third
    party running from the public mirror, which ships the registry but not the
    cli/ corpora cards). The entry carries the pair, the per-pair OPUS moses
    archive URL + sha, and the build recipe, so the adapter has everything it
    needs without a card.
    """
    from mt_eval_harness.corpus_build.adapters import tatoeba_opus_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    return tatoeba_opus_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "tatoeba-opus",
        recipe=export.get("recipe"),
        archive_sha256=export.get("sha256"),
        expected_size=entry.get("size"),
        auto_yes=assume_yes,
    )


def _build_tico19_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'tico19-parallel' registry source_export entries.

    TICO-19 is the public (CC0) COVID-19 / medical-crisis multi-way set;
    the registry entry carries the pair and the archive sha. The adapter
    downloads the test-set zip once and builds the requested pair via the
    English pivot. Mirrors ``_build_globalvoices_parallel_entry``.
    """
    from mt_eval_harness.corpus_build.adapters import tico19_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    return tico19_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "tico19",
        segment=export.get("segment", "test"),
        archive_sha256=export.get("sha256"),
        expected_size=entry.get("size"),
        auto_yes=assume_yes,
    )


def _build_in22_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'in22-parallel' registry source_export entries.

    IN22 (AI4Bharat IndicTrans2) is GATED on HuggingFace; the adapter reads
    an HF token and fails loud with accept-terms instructions when it is
    missing. The conv/gen subset is taken from the multiway card the entry
    expands from. Mirrors ``_build_globalvoices_parallel_entry``.
    """
    from mt_eval_harness.corpus_build.adapters import in22_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    subset = "conv" if "conv" in (entry.get("multiway_card") or "") else "gen"
    return in22_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "in22",
        subset=subset,
        repo_url=export.get("url"),
        archive_sha256=export.get("sha256"),
        expected_size=entry.get("size"),
        domain=entry.get("domain"),
        # Gated-download metadata (from the card's download block, carried into
        # source_export by build_registry) → drives the fail-honest messages.
        terms_url=export.get("terms_url"),
        token_env=export.get("token_env") or "HF_TOKEN",
        auto_yes=assume_yes,
    )


def _build_alt_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'alt-parallel' registry source_export entries.

    ALT (Asian Language Treebank, CC-BY-4.0) is genuinely 13-way parallel;
    the registry entry carries the pair (project ISO codes), the corpus-zip
    sha, and the split-definition (URL-{segment}.txt) sha. Per-pair sizes
    vary slightly (ALT never translated a few sentences into every language;
    empty cells are dropped per the loud-failure policy), so size is NOT
    enforced here — the archive sha already pins the content byte-for-byte.
    """
    from mt_eval_harness.corpus_build.adapters import alt_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    return alt_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "alt",
        segment=export.get("segment", "test"),
        archive_sha256=export.get("sha256"),
        url_split_sha256=export.get("split_sha256"),
        expected_size=None,
        auto_yes=True,
    )


def _build_turkicxwmt_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'turkicxwmt-parallel' registry source_export entries.

    Turkic X-WMT (MIT) is 10-way (8 Turkic + en + ru) all-pairs. Per-direction
    size is NOT uniform — it ranges from 300 to 1000 sentences depending on the
    pair — so each entry carries its own true size, which is enforced here. The
    single test.zip is pinned to an immutable git commit and sha-verified.
    """
    from mt_eval_harness.corpus_build.adapters import turkicxwmt_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    return turkicxwmt_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "turkicxwmt",
        archive_sha256=export.get("sha256"),
        expected_size=entry.get("size") or None,
        auto_yes=True,
    )


def _build_arabench_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'arabench-parallel' registry source_export entries.

    AraBench (QCRI) is dialectal-Arabic↔English; the explicit-pair entry
    carries the pair (a dialect ISO ↔ eng) and the aggregated per-dialect
    size, which is enforced. The single tgz is sha-verified.
    """
    from mt_eval_harness.corpus_build.adapters import arabench_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    return arabench_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        cache_dir=CACHE_DIR / "arabench",
        archive_sha256=export.get("sha256"),
        segment=export.get("segment", "test"),
        expected_size=entry.get("size") or None,
        auto_yes=True,
    )


def _build_wmt24pp_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'wmt24pp-parallel' registry source_export entries.

    WMT24++ (Apache-2.0) is English-source only; the explicit-pair entry
    carries the project target label, the WMT24++ file code (e.g. 'fr_CA')
    in source_codes.target, the immutable HF commit ``revision``, and the
    post-edit-filtered size, which is enforced.
    """
    from mt_eval_harness.corpus_build.adapters import wmt24pp_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    codes = entry.get("source_codes") or {}
    return wmt24pp_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        target_code=codes.get("target"),
        cache_dir=CACHE_DIR / "wmt24pp",
        revision=export.get("revision"),
        repo_url=export.get("url"),
        expected_size=entry.get("size") or None,
        auto_yes=True,
    )


def _build_smol_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'smol-parallel' registry source_export entries.

    SMOL (CC-BY-4.0) ships one directed pair per file; the explicit-pair
    entry carries the SMOL upstream file codes in source_codes, the subset
    (smolsent/smoldoc), the immutable HF commit ``revision``, and the size
    (enforced when pinned). GATITOS is excluded by the adapter.
    """
    from mt_eval_harness.corpus_build.adapters import smol_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    codes = entry.get("source_codes") or {}
    return smol_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        src_code=codes.get("source"),
        tgt_code=codes.get("target"),
        subset=export.get("subset", "smolsent"),
        cache_dir=CACHE_DIR / "smol",
        revision=export.get("revision"),
        repo_url=export.get("url"),
        expected_size=entry.get("size") or None,
        auto_yes=True,
    )


def _build_bouquet_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for 'bouquet-parallel' registry source_export entries.

    BOUQuET (Meta FAIR, CC-BY-4.0, LOW contamination) is GATED on HuggingFace
    and ships PARQUET — the adapter fails loud when the HF token or the
    optional pyarrow dependency is missing. Its cards ship QUARANTINED
    (catalogue-only) until access + the parquet schema are verified, so this
    builder is registered (so the buildability gate and a manual fetch both
    work) but quarantined pairs never reach the queue.
    """
    from mt_eval_harness.corpus_build.adapters import bouquet_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    codes = entry.get("source_codes") or {}
    return bouquet_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        src_code=codes.get("source"),
        tgt_code=codes.get("target"),
        cache_dir=CACHE_DIR / "bouquet",
        split=export.get("segment", "dev"),
        revision=export.get("revision"),
        repo_url=export.get("url"),
        expected_size=entry.get("size") or None,
        auto_yes=True,
    )


def _build_wmt_general_parallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Builder for the WMT General/News blind test sets (sacreBLEU ``-t``).

    One generic builder serves every WMT edition: each per-year card
    (``eval-wmt19-news-test-v1`` …) dispatches to ``wmt19-parallel`` →
    ``WMT_GENERAL_TESTSETS`` registers them all here. The sacreBLEU testset id
    IS the builder-id stem (``wmt19-parallel`` → ``wmt19``), and the sacreBLEU
    langpair is reconstructed from the per-pair upstream codes
    (``source_codes`` = {'source': 'en', 'target': 'de'} → ``en-de``). The
    pinned sacreBLEU version rides ``source_export.revision`` as
    ``sacrebleu-<ver>``. License is research-use (relative-only / out of every
    commercial lane); sacreBLEU caches the raw data outside the tracked tree.
    """
    from mt_eval_harness.corpus_build.adapters import wmt_general_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    codes = entry.get("source_codes") or {}

    builder_id = export.get("builder") or ""
    testset = builder_id[: -len("-parallel")] if builder_id.endswith("-parallel") else builder_id
    src_code = codes.get("source")
    tgt_code = codes.get("target")
    if not src_code or not tgt_code:
        raise ValueError(
            f"WMT entry '{entry.get('id', '?')}' is missing source_codes "
            f"(sacreBLEU langpair halves) — cannot resolve the langpair to fetch."
        )
    langpair = f"{src_code}-{tgt_code}"

    revision = (export.get("revision") or "").strip()
    pinned_version = revision[len("sacrebleu-"):] if revision.startswith("sacrebleu-") else None

    return wmt_general_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        testset=testset,
        langpair=langpair,
        cache_dir=CACHE_DIR / "wmt-general",
        domain=entry.get("domain") or "news",
        expected_size=entry.get("size") or None,
        pinned_sacrebleu_version=pinned_version,
        auto_yes=True,
    )


#: The WMT editions served by the single ``wmt_general_adapter``. Each per-year
#: card's builder id is ``{testset}-parallel`` (card_id.split('-')[1] in
#: build_registry), so every edition is registered here pointing at the one
#: generic builder. wmt25 is registered too (forward-compatible) even though it
#: ships quarantined until the installed sacreBLEU bundles it.
WMT_GENERAL_TESTSETS = (
    "wmt14", "wmt15", "wmt16", "wmt17", "wmt18", "wmt19",
    "wmt20", "wmt21", "wmt22", "wmt23", "wmt24", "wmt25",
)


def _build_lineparallel(
    entry: dict[str, Any], dest: Path, *, assume_yes: bool,
) -> Path:
    """Generic builder for line-parallel fetch-from-source benchmarks.

    The "recipes, not adapters" transport (master-plan A1, 2026-07-07): two
    line-aligned files at a pinned GitHub commit, resolved by the card's
    ``file_pattern`` (placeholders ``{lang_code}``/``{src_code}``/
    ``{tgt_code}``). Everything benchmark-specific rides the registry entry:
    repo URL + pinned ``revision`` + ``file_pattern`` on ``source_export``,
    the upstream file codes on ``source_codes``, and the family token on
    ``source_export.family`` (falling back to the builder-id stem for the
    legacy per-family ids like ``americasnlp2021-parallel``). The family
    token is stamped into the built corpus's ``source_dataset``, so it is
    part of the sha-pinned bytes — never change it for a landed card.
    ``source_export.pairing`` (optional) selects a single-file pairing mode
    (tsv-columns / csv-columns / json-fields — the 2026-07-07 extension);
    absent means the two-file line-zip default.
    """
    from mt_eval_harness.corpus_build.adapters import lineparallel_adapter

    export = entry["source_export"]
    pair = entry["language_pair"]
    codes = entry.get("source_codes") or {}

    builder_id = export.get("builder") or ""
    stem = (builder_id[: -len("-parallel")]
            if builder_id.endswith("-parallel") else builder_id)
    family = export.get("family") or stem
    src_code = codes.get("source")
    tgt_code = codes.get("target")
    if not src_code or not tgt_code:
        raise ValueError(
            f"Line-parallel entry '{entry.get('id', '?')}' is missing "
            f"source_codes (the upstream file suffixes) — cannot resolve "
            f"which split files to fetch."
        )
    file_pattern = export.get("file_pattern")
    if not file_pattern:
        raise ValueError(
            f"Line-parallel entry '{entry.get('id', '?')}' has no "
            f"source_export.file_pattern — cannot resolve member paths."
        )

    return lineparallel_adapter.build_corpus_file(
        dest,
        source_lang=pair["source"],
        target_lang=pair["target"],
        src_code=src_code,
        tgt_code=tgt_code,
        cache_dir=CACHE_DIR / "lineparallel" / family,
        repo_url=export.get("url") or "",
        revision=export.get("revision") or "",
        dataset_tag=family,
        file_pattern=file_pattern,
        domain=entry.get("domain") or "conv",
        expected_size=entry.get("size") or None,
        auto_yes=True,
        src_member=export.get("src_member"),
        tgt_member=export.get("tgt_member"),
        pairing=export.get("pairing"),
    )


#: Legacy per-family builder ids served by the generic line-parallel builder.
#: Registry entries built before the A1 recipe refactor (2026-07-07) carry
#: ``americasnlp2021-parallel``; new recipe cards carry the explicit
#: ``download.builder: "lineparallel"`` override instead, so this tuple only
#: grows if an already-published registry pinned a per-family id. (AmericasNLP
#: 2023 withheld its test references — not scoreable, no card; add an id here
#: only for backward compatibility, never for new cards.)
LINEPARALLEL_LEGACY_IDS = ("americasnlp2021",)


#: builder id (registry source_export.builder) → build callable.
#: These let the harness fetch from the registry alone — no corpora card
#: required — which is what makes a standalone install (just the registry +
#: this package) able to auto-download corpora.
REGISTRY_BUILDERS: dict[str, Callable[..., Path]] = {
    "tatoeba-challenge": _build_tatoeba_challenge,
    "tatoeba-opus": _build_tatoeba_opus,
    "flores-parallel": _build_flores_parallel,
    "ntrex-parallel": _build_ntrex_parallel,
    "globalvoices-parallel": _build_globalvoices_parallel_entry,
    "tico19-parallel": _build_tico19_parallel,
    "in22-parallel": _build_in22_parallel,
    # Six-corpora buildout (2026-06-19) — commercial-safe, fetch-from-source.
    "alt-parallel": _build_alt_parallel,
    "turkicxwmt-parallel": _build_turkicxwmt_parallel,
    "arabench-parallel": _build_arabench_parallel,
    "wmt24pp-parallel": _build_wmt24pp_parallel,
    "smol-parallel": _build_smol_parallel,
    "bouquet-parallel": _build_bouquet_parallel,
    # WMT General/News blind test sets (sacreBLEU -t fetch-on-demand) — the
    # clean held-out tier (newstest 2014–2021 + General MT 2022–2025). One
    # generic builder, registered under every edition's id.
    **{f"{ts}-parallel": _build_wmt_general_parallel for ts in WMT_GENERAL_TESTSETS},
    # Generic line-parallel transport ("recipes, not adapters", A1 2026-07-07):
    # any two line-aligned files at a pinned GitHub commit. New benchmarks are
    # pure data — a corpora-card recipe with download.builder="lineparallel" —
    # no new Python. Legacy per-family ids (pre-refactor registries) alias to
    # the same builder.
    "lineparallel-parallel": _build_lineparallel,
    **{f"{fam}-parallel": _build_lineparallel for fam in LINEPARALLEL_LEGACY_IDS},
}


# ---------------------------------------------------------------------------
# Fetch orchestration
# ---------------------------------------------------------------------------

def _non_interactive() -> bool:
    """True when we must not prompt (CI or stdin is not a TTY)."""
    if os.environ.get("CI", "").lower() in ("1", "true", "yes"):
        return True
    try:
        return not sys.stdin.isatty()
    except (AttributeError, ValueError):
        return True


def _confirm_fetch(card: dict[str, Any], *, assume_yes: bool) -> bool:
    """Ask the user to confirm the fetch+build (license acceptance).

    With ``assume_yes`` (--yes flag) or CI=true the prompt is skipped
    and the fetch proceeds. In any other non-interactive context we
    refuse rather than hang on input().
    """
    source = card["source"]
    print()
    print(f"  Corpus '{card.get('id', '?')}' is not present locally.")
    print(f"  It can be fetched from source and built into the local cache:")
    print(f"    Repo:    {source['repo_url']} (ref: {source.get('ref', 'HEAD')})")
    print(f"    License: {source.get('license', 'see card')} "
          f"({source.get('license_url', '')})")
    print(f"    Builder: {source['builder']}")
    print()
    print("  You are responsible for complying with this license.")

    if assume_yes or any(
        os.environ.get(var, "").lower() in ("1", "true", "yes")
        for var in ("CI", "MT_EVAL_AUTO_SETUP")
    ):
        print("  --yes/CI/MT_EVAL_AUTO_SETUP set, proceeding automatically.")
        return True

    if _non_interactive():
        raise RuntimeError(
            f"Corpus for card '{card.get('id', '?')}' must be fetched from "
            f"{source['repo_url']}, but this is a non-interactive session. "
            f"Re-run with --yes to accept the {source.get('license', '')} "
            f"license terms and fetch automatically."
        )

    try:
        answer = input("  Fetch and build now? [y/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n  Cancelled.")
        return False
    return answer in ("y", "yes")


def _verify_sha256(built: Path, expected: str | None, card_id: str) -> None:
    """Verify a built corpus against the card's pinned hash."""
    if not expected:
        logger.info("No sha256 pinned for '%s' — skipping verification", card_id)
        return
    actual = hashlib.sha256(built.read_bytes()).hexdigest()
    if actual != expected:
        built_path = str(built)
        built.unlink(missing_ok=True)
        raise ValueError(
            f"SHA-256 mismatch for corpus built from card '{card_id}':\n"
            f"  Expected: {expected}\n"
            f"  Got:      {actual}\n"
            f"  The built file ({built_path}) was deleted. The upstream "
            f"repo may have changed since the card's ref/sha256 were "
            f"pinned — re-verify the card's source block."
        )
    logger.info("SHA-256 verified for '%s'", card_id)


def _confirm_fetch_export(
    entry: dict[str, Any], *, assume_yes: bool,
) -> bool:
    """License confirmation for a registry source_export fetch.

    Same gating rules as ``_confirm_fetch``: --yes / CI proceed,
    non-interactive without them raises, otherwise prompt.
    """
    export = entry["source_export"]
    print()
    print(f"  Corpus '{entry.get('id', '?')}' is not present locally.")
    print(f"  It can be fetched from source and built into the local cache:")
    print(f"    Export:  {export.get('url', '?')}")
    print(f"    License: {export.get('license', entry.get('license', 'see registry'))} "
          f"({export.get('license_url', '')})")
    print(f"    Builder: {export['builder']}")
    print()
    print("  You are responsible for complying with this license.")

    if assume_yes or any(
        os.environ.get(var, "").lower() in ("1", "true", "yes")
        for var in ("CI", "MT_EVAL_AUTO_SETUP")
    ):
        print("  --yes/CI/MT_EVAL_AUTO_SETUP set, proceeding automatically.")
        return True

    if _non_interactive():
        raise RuntimeError(
            f"Corpus '{entry.get('id', '?')}' must be fetched from "
            f"{export.get('url', 'its upstream export')}, but this is a "
            f"non-interactive session. Re-run with --yes to accept the "
            f"{export.get('license', '')} license terms and fetch "
            f"automatically."
        )

    try:
        answer = input("  Fetch and build now? [y/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n  Cancelled.")
        return False
    return answer in ("y", "yes")


def fetch_corpus_from_registry_entry(
    entry: dict[str, Any],
    *,
    assume_yes: bool = False,
) -> Path:
    """Fetch+build the corpus described by a registry source_export block.

    Builds into ``arena/datasets/.cache/<entry path>`` (gitignored) and
    verifies the entry's ``sha256`` when present. Reuses a previously
    built cache file if it passes hash verification.
    """
    export = entry["source_export"]
    builder_id = export["builder"]
    build = REGISTRY_BUILDERS.get(builder_id)
    if build is None:
        raise RuntimeError(
            f"Registry entry '{entry.get('id', '?')}' declares unknown "
            f"source_export builder '{builder_id}'. Known builders: "
            f"{sorted(REGISTRY_BUILDERS)}."
        )

    dest = CACHE_DIR / entry["path"]
    if dest.exists():
        try:
            _verify_sha256(dest, entry.get("sha256"), entry.get("id", "?"))
            logger.info("Using cached built corpus at %s", dest)
            return dest
        except ValueError:
            logger.warning("Cached build failed verification — rebuilding")

    if not _confirm_fetch_export(entry, assume_yes=assume_yes):
        raise RuntimeError(
            f"Fetch declined for registry corpus '{entry.get('id', '?')}'. "
            f"Provide the corpus file locally or re-run and accept the fetch."
        )

    built = build(entry, dest, assume_yes=True)  # license accepted above
    _verify_sha256(built, entry.get("sha256"), entry.get("id", "?"))
    print(f"  Built corpus cached at {built}")
    return built


def fetch_corpus_from_card(
    card: dict[str, Any],
    data_file: str,
    *,
    assume_yes: bool = False,
) -> Path:
    """Fetch+build the corpus described by a card's source block.

    Builds into ``arena/datasets/.cache/<data_file>`` (gitignored) and
    verifies the card's sha256 when present. Reuses a previously built
    cache file if it passes hash verification.

    Raises:
        RuntimeError: Unknown builder, or non-interactive without --yes.
        ConnectionError: Offline / upstream unreachable.
        ValueError: SHA-256 mismatch.
    """
    source = card["source"]
    builder_id = source["builder"]
    build = BUILDERS.get(builder_id)
    if build is None:
        raise RuntimeError(
            f"Corpora card '{card.get('id', '?')}' declares unknown builder "
            f"'{builder_id}'. Known builders: {sorted(BUILDERS)}."
        )

    dest = CACHE_DIR / data_file
    if dest.exists():
        try:
            _verify_sha256(dest, source.get("sha256"), card.get("id", "?"))
            logger.info("Using cached built corpus at %s", dest)
            return dest
        except ValueError:
            logger.warning("Cached build failed verification — rebuilding")

    if not _confirm_fetch(card, assume_yes=assume_yes):
        raise RuntimeError(
            f"Fetch declined for corpus card '{card.get('id', '?')}'. "
            f"Provide the corpus file locally or re-run and accept the fetch."
        )

    built = build(card, dest, assume_yes=True)  # license already accepted above
    _verify_sha256(built, source.get("sha256"), card.get("id", "?"))
    print(f"  Built corpus cached at {built}")
    return built


def try_fetch_missing_corpus(
    corpus_path: str | Path,
    *,
    assume_yes: bool = False,
    cards_dir: Path | None = None,
    registry_path: Path | None = None,
) -> Path | None:
    """Resolve a missing corpus path via fetch-from-source.

    Resolution order: corpora cards first (richer per-corpus metadata),
    then registry ``source_export`` entries. Returns the path to the
    built corpus in the cache, or None when nothing fetchable matches
    (caller should raise its usual FileNotFoundError).
    """
    match = find_card_for_corpus(corpus_path, cards_dir=cards_dir)
    if match is not None:
        card, data_file = match
        return fetch_corpus_from_card(card, data_file, assume_yes=assume_yes)

    entry = find_registry_export_for_corpus(
        corpus_path, registry_path=registry_path,
    )
    if entry is not None:
        return fetch_corpus_from_registry_entry(entry, assume_yes=assume_yes)

    return None
