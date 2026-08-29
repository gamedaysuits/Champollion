# Ported from the internal corpora-builder (founder decision 2026-08-27):
# the fetch-on-miss corpus REBUILD path must work in the open-source harness
# — 5,595 of 5,602 registry corpora are fetch-from-source and corpus content
# is never tracked, so without these primitives a public clone could browse
# the queue and rebuild nothing (docs/PRE_REVIEW_HARDENING_2026-08-27.md).
# The intake/probe/recipe-authoring tooling remains in the private builder;
# this subpackage ships with the harness under the harness's license.
# Byte-parity with the private builder's copy is protected by the per-pair
# sha guards: a divergent rebuild fails loudly at publish, never silently.
"""
Tatoeba Challenge adapter — deterministic dev-corpus builds from the
consolidated test-set tar of a pinned Tatoeba Challenge release.

Why this exists (vs. ``tatoeba_adapter``)
-----------------------------------------
The original adapter downloads one OPUS tar **per language pair**. Those
per-pair tars front-load the (potentially multi-GB) ``train.src.gz``
member, so extracting the few-hundred-KB test split of a high-resource
pair means streaming gigabytes. The Tatoeba Challenge also publishes a
single consolidated archive containing *every* pair's test split:

    https://object.pouta.csc.fi/Tatoeba-Challenge-devtest/test-v2023-09-26.tar
    (~169 MB, 677 pairs, CC-BY 2.0)

One download — cached in the gitignored ``arena/datasets/.cache/`` —
serves every mesh pair. Champollion never rehosts the data (we
distribute build recipes, not corpora; see ``licensing.py``): the
corpus registry pins this URL, its sha256, and the extraction recipe,
and the harness rebuilds corpora locally on demand.

Tar layout::

    data/test-v2023-09-26/{lang1-lang2}/test.txt

where ``lang1-lang2`` is alphabetical and each ``test.txt`` line is::

    src_lang \\t trg_lang \\t source_text \\t target_text

The per-line language columns make direction explicit, so a corpus can
be built in either direction from the same member file.

Determinism contract
--------------------
``build_corpus_file()`` must be byte-reproducible from (tar, recipe):
the registry pins the built file's sha256 and the harness verifies it
after every fetch-on-miss rebuild. Everything that would otherwise
vary is therefore pinned in the recipe — including the ``created``
timestamp and the builder version string written into the corpus
header. If enrichment heuristics (domain classifier, difficulty
estimator) change behaviour in a future corpora-builder release,
rebuilds will hash differently: bump the corpus version and re-pin the
registry rather than papering over the mismatch.
"""

from __future__ import annotations

import hashlib
import logging
import tarfile
from pathlib import Path
from typing import Any

import requests

from mt_eval_harness.corpus_build import __version__, USER_AGENT
from mt_eval_harness.corpus_build.adapters.base import RawEntry
from mt_eval_harness.corpus_build.adapters.tatoeba_adapter import _normalise_lang
from mt_eval_harness.corpus_build.licensing import LicenseInfo, confirm_download
from mt_eval_harness.corpus_build.schema import Corpus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pinned release constants
# ---------------------------------------------------------------------------

#: Tatoeba Challenge release used for all mesh corpora.
RELEASE = "v2023-09-26"

#: Consolidated test-set archive (all pairs, one tar).
TEST_TAR_URL = (
    "https://object.pouta.csc.fi/Tatoeba-Challenge-devtest/"
    f"test-{RELEASE}.tar"
)

#: sha256 of TEST_TAR_URL as pinned on 2026-06-12. The release is
#: versioned and treated as immutable upstream; a mismatch means the
#: object changed and every downstream pin must be re-audited.
TEST_TAR_SHA256 = (
    "9eef2fb5fe4551401de3675d8e98ad0e9455d063ab51c77ad85870f4b38a39f2"
)

#: Per-pair size index of the release (test/dev/train sentence-pair
#: counts) — used by the probe, not by builds.
INDEX_URL = (
    "https://raw.githubusercontent.com/Helsinki-NLP/Tatoeba-Challenge/"
    f"master/data/release/{RELEASE}/released-bitexts.txt"
)

#: Default extraction recipe. A registry ``source_export.recipe`` may
#: override any field; ``created`` is part of the recipe because the
#: corpus header embeds it and builds must be byte-reproducible.
#:
#: ``length_unit`` selects the entry-length filter: "words" applies the
#: standard min/max_words window to whitespace tokens of the source
#: text; "chars" applies min/max_chars to its character length instead,
#: for source languages without whitespace word boundaries (jpn, cmn,
#: tha, …) where every sentence is one "word" and a word window would
#: reject the entire corpus. The wave builder falls back to "chars"
#: automatically when the word window rejects everything, and the
#: registry pins whichever recipe actually produced the corpus.
DEFAULT_RECIPE: dict[str, Any] = {
    "release": RELEASE,
    "split": "test",
    "seed": 42,
    "max_entries": 200,
    "length_unit": "words",
    "min_words": 3,
    "max_words": 50,
    "min_chars": 8,
    "max_chars": 250,
    "variety_filter": None,
    "created": "2026-06-12T00:00:00+00:00",
    "builder_version": __version__,
}

CHALLENGE_LICENSE = LicenseInfo(
    source_name="Tatoeba Challenge (Tatoeba data)",
    license_id="CC-BY-2.0",
    license_url="https://creativecommons.org/licenses/by/2.0/",
    source_url="https://github.com/Helsinki-NLP/Tatoeba-Challenge",
    download_url=TEST_TAR_URL,
)

#: Release pair-key codes that differ from the ISO 639-3 codes used by
#: the registry and language cards. Only unambiguous one-to-one renames
#: belong here ("zho" is Tatoeba's Mandarin, per TATOEBA_LANG_MAP; the
#: member rows are tagged cmn_Hans/cmn_Hant and orientation matching
#: drops the yue/wuu/lzh rows mixed into the same member). Macro codes
#: that aggregate several registry languages — msa (zsm…), hbs
#: (bos/srp/hrv), nor (nob/nno) — are intentionally NOT mapped: building
#: a member language's corpus from a macro pair file is a taxonomy
#: decision, not a spelling fix. See docs/LANGUAGE_TAXONOMY.md.
RELEASE_CODE_MAP: dict[str, str] = {"zho": "cmn"}
_ISO_TO_RELEASE: dict[str, str] = {v: k for k, v in RELEASE_CODE_MAP.items()}


def release_pair_key(lang_a: str, lang_b: str) -> str:
    """Alphabetical release pair key for two ISO codes: cmn,deu → deu-zho."""
    a = _ISO_TO_RELEASE.get(lang_a, lang_a)
    b = _ISO_TO_RELEASE.get(lang_b, lang_b)
    return f"{min(a, b)}-{max(a, b)}"


def iso_pair_key(release_pair: str) -> str:
    """Normalise a release pair key into ISO space: deu-zho → cmn-deu."""
    a, b = release_pair.split("-", 1)
    a = RELEASE_CODE_MAP.get(a, a)
    b = RELEASE_CODE_MAP.get(b, b)
    return f"{min(a, b)}-{max(a, b)}"


# ---------------------------------------------------------------------------
# Archive handling
# ---------------------------------------------------------------------------

def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1_048_576), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_test_tar(
    cache_dir: str | Path,
    *,
    url: str = TEST_TAR_URL,
    expected_sha256: str | None = TEST_TAR_SHA256,
    auto_yes: bool = False,
) -> Path:
    """Return the consolidated test tar, downloading into the cache once.

    The tar is verified against ``expected_sha256`` both after download
    and on cache hits, so a corrupted or upstream-changed archive can
    never feed a build silently.
    """
    cache_dir = Path(cache_dir)
    tar_path = cache_dir / url.rsplit("/", 1)[-1]

    if tar_path.exists():
        if expected_sha256:
            actual = _sha256_file(tar_path)
            if actual != expected_sha256:
                logger.warning(
                    "Cached %s fails sha256 verification — re-downloading",
                    tar_path.name,
                )
                tar_path.unlink()
            else:
                return tar_path
        else:
            return tar_path

    if not tar_path.exists():
        license_info = LicenseInfo(
            source_name=CHALLENGE_LICENSE.source_name,
            license_id=CHALLENGE_LICENSE.license_id,
            license_url=CHALLENGE_LICENSE.license_url,
            source_url=CHALLENGE_LICENSE.source_url,
            download_url=url,
        )
        if not confirm_download(license_info, auto_yes=auto_yes):
            raise RuntimeError(
                "Download declined — cannot build Tatoeba Challenge corpora "
                "without the consolidated test archive."
            )
        cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Downloading %s → %s", url, tar_path)
        resp = requests.get(
            url, stream=True, timeout=600,
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        tmp_path = tar_path.with_suffix(".part")
        with open(tmp_path, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1_048_576):
                fh.write(chunk)
        tmp_path.rename(tar_path)

    if expected_sha256:
        actual = _sha256_file(tar_path)
        if actual != expected_sha256:
            tar_path.unlink()
            raise ValueError(
                f"Downloaded Tatoeba Challenge archive failed sha256 "
                f"verification:\n  Expected: {expected_sha256}\n"
                f"  Got:      {actual}\n"
                f"The upstream object may have changed — re-audit the "
                f"release pin before rebuilding any corpora."
            )
    return tar_path


def list_tar_pairs(tar_path: str | Path) -> set[str]:
    """Return the alphabetical ``lang1-lang2`` pair keys present in the tar."""
    pairs: set[str] = set()
    with tarfile.open(tar_path) as tf:
        for name in tf.getnames():
            parts = name.split("/")
            # data/test-v2023-09-26/{pair}/test.txt
            if len(parts) == 4 and parts[-1] == "test.txt":
                pairs.add(parts[2])
    return pairs


def extract_pair_rows(
    tar_path: str | Path,
    pair: str,
) -> list[tuple[str, str, str, str]]:
    """Extract one pair's test rows: (src_lang, trg_lang, src_text, trg_text).

    Language codes are returned exactly as the release spells them;
    callers normalise via ``_normalise_lang`` when orienting.
    """
    member = f"data/test-{RELEASE}/{pair}/test.txt"
    with tarfile.open(tar_path) as tf:
        try:
            fobj = tf.extractfile(member)
        except KeyError:
            fobj = None
        if fobj is None:
            raise FileNotFoundError(
                f"Pair '{pair}' has no test split in {tar_path} "
                f"(member {member} not found)."
            )
        text = fobj.read().decode("utf-8")

    rows: list[tuple[str, str, str, str]] = []
    malformed = 0
    for line in text.splitlines():
        if not line.strip():
            continue
        cols = line.split("\t")
        if len(cols) < 4:
            malformed += 1
            continue
        rows.append((cols[0].strip(), cols[1].strip(),
                     cols[2].strip(), cols[3].strip()))
    if malformed:
        raise ValueError(
            f"{member} contained {malformed} malformed row(s) "
            f"(expected 4 tab-separated columns). Corrupted archive?"
        )
    return rows


# ---------------------------------------------------------------------------
# Orientation + RawEntry construction
# ---------------------------------------------------------------------------

def _strip_script(code: str) -> str:
    """Drop a BCP-47-style script/region suffix: ``kaz_Cyrl`` → ``kaz``.

    The release tags some sides with the writing system (``tgl_Latn``,
    ``kaz_Cyrl``, ``cmn_Hans``…). Pair *identity* is the bare language
    code; script variants of one language are matched together. A recipe
    can pin ``variety_filter`` to restrict a build to one tagged variety
    (relevant for multi-script languages like cmn_Hans/cmn_Hant).
    """
    return code.split("_", 1)[0]


def rows_to_raw_entries(
    rows: list[tuple[str, str, str, str]],
    source_lang: str,
    target_lang: str,
    *,
    variety_filter: str | None = None,
) -> list[RawEntry]:
    """Orient release rows into the requested direction as RawEntries.

    Rows whose language columns match (source→target) pass through;
    rows in the opposite direction are swapped; rows mentioning other
    language codes are skipped. Script suffixes are stripped for
    matching (see ``_strip_script``); ``variety_filter`` optionally
    requires one exact tagged code to appear on the line. Exact
    duplicate pairs (post-orientation) are dropped, preserving
    first-seen order so the result is deterministic for a given member
    file.

    Entry IDs are content hashes (``hash_<sha256[:12]>``) because the
    consolidated test files don't carry Tatoeba sentence IDs; content
    hashing keeps IDs stable across rebuilds.
    """
    want_src = _normalise_lang(source_lang)
    want_trg = _normalise_lang(target_lang)

    entries: list[RawEntry] = []
    seen: set[tuple[str, str]] = set()
    skipped_variety = 0

    for row_src_lang, row_trg_lang, row_src, row_trg in rows:
        if variety_filter and variety_filter not in (row_src_lang,
                                                     row_trg_lang):
            skipped_variety += 1
            continue
        a = _normalise_lang(_strip_script(row_src_lang))
        b = _normalise_lang(_strip_script(row_trg_lang))
        if (a, b) == (want_src, want_trg):
            src_text, trg_text = row_src, row_trg
        elif (a, b) == (want_trg, want_src):
            src_text, trg_text = row_trg, row_src
        else:
            skipped_variety += 1
            continue

        if not src_text or not trg_text or src_text == trg_text:
            continue
        key = (src_text, trg_text)
        if key in seen:
            continue
        seen.add(key)

        content_hash = hashlib.sha256(
            f"{src_text}|{trg_text}".encode("utf-8")
        ).hexdigest()[:12]
        entries.append(RawEntry(
            source_text=src_text,
            target_text=trg_text,
            source_id=f"hash_{content_hash}",
            metadata={
                "source_lang": want_src,
                "target_lang": want_trg,
                "license": "CC-BY-2.0",
                "url": TEST_TAR_URL,
            },
        ))

    if not entries:
        raise ValueError(
            f"No rows matched direction {want_src}→{want_trg} "
            f"({skipped_variety} rows carried other language codes). "
            f"Wrong pair member or unexpected variety codes."
        )
    if skipped_variety:
        logger.info(
            "Skipped %d rows with non-matching variety codes for %s→%s",
            skipped_variety, want_src, want_trg,
        )
    return entries


# ---------------------------------------------------------------------------
# Folder resolution — incl. macro members (nob/nno→nor, hrv/srp/bos→hbs, …)
#
# The Challenge stores each test set in ONE folder named by the release pair
# key, but a macro folder (e.g. nor-zho) carries member-tagged rows
# (nob/nno × cmn_Hans/cmn_Hant) on every line. To support the ENTIRE Challenge
# we resolve a member pair to its containing folder from the tar's actual
# contents. This is derived from the sha-pinned tar, so build and the harness's
# fetch-on-load resolve identically (same folder → same rows → same sha).
# ---------------------------------------------------------------------------

#: Per-tar cache of (folders, {(src,tgt): folder}) — built once, reused.
_TAR_COMBO_INDEX: dict[str, tuple[frozenset, dict]] = {}


def _tar_combo_index(tar_path: str | Path) -> tuple[frozenset, dict]:
    """Index the tar's per-line language columns: every directed (src,tgt)
    combo → the (alphabetically-first, hence deterministic) folder holding it.
    Returns (set of folder names, {(norm_src, norm_tgt): folder})."""
    key = str(tar_path)
    cached = _TAR_COMBO_INDEX.get(key)
    if cached is not None:
        return cached
    folders: set[str] = set()
    combo_to_folder: dict[tuple[str, str], str] = {}
    with tarfile.open(tar_path) as tf:
        members = sorted(
            (m for m in tf.getmembers()
             if m.name.endswith("/test.txt") and len(m.name.split("/")) == 4),
            key=lambda m: m.name,
        )
        for m in members:
            folder = m.name.split("/")[2]
            folders.add(folder)
            fobj = tf.extractfile(m)
            if fobj is None:
                continue
            for raw in fobj:
                cols = raw.decode("utf-8", "replace").split("\t")
                if len(cols) < 4:
                    continue
                a = _normalise_lang(_strip_script(cols[0].strip()))
                b = _normalise_lang(_strip_script(cols[1].strip()))
                if not a or not b or a == b:
                    continue
                combo_to_folder.setdefault((a, b), folder)
                combo_to_folder.setdefault((b, a), folder)
    result = (frozenset(folders), combo_to_folder)
    _TAR_COMBO_INDEX[key] = result
    return result


def resolve_member_folder(
    tar_path: str | Path, source_lang: str, target_lang: str,
) -> str:
    """The tar folder containing rows for this (src,tgt) combo.

    Prefers the direct release pair-key folder when it exists (so normal,
    non-macro pairs build byte-identically to before), and falls back to the
    macro folder that holds the member rows. Deterministic from the pinned
    tar, so build and fetch-on-load agree.
    """
    src = _normalise_lang(source_lang)
    tgt = _normalise_lang(target_lang)
    folders, combo_to_folder = _tar_combo_index(tar_path)
    direct = release_pair_key(src, tgt)
    if direct in folders:
        return direct
    folder = combo_to_folder.get((src, tgt))
    if folder is None:
        raise FileNotFoundError(
            f"No Tatoeba Challenge test rows for {src}→{tgt} in {tar_path}."
        )
    return folder


# ---------------------------------------------------------------------------
# One-call deterministic build (harness fetch-on-miss entry point)
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    cache_dir: Path,
    recipe: dict[str, Any] | None = None,
    tar_url: str = TEST_TAR_URL,
    tar_sha256: str | None = TEST_TAR_SHA256,
    auto_yes: bool = False,
) -> Path:
    """Build one direction's dev corpus from the pinned Challenge release.

    Mirrors ``edtekla_adapter.build_corpus_file``: downloads (with
    license confirmation) into ``cache_dir``, rebuilds deterministically,
    writes harness-format JSON to ``dest`` and returns it.

    The build pipeline is the standard corpora-builder one — adapter
    rows → word-count filter → domain/difficulty/register enrichment →
    seeded stratified sampling — with every free parameter taken from
    ``recipe`` so rebuilds are byte-identical.
    """
    # Imported here (like the other build paths) to keep adapter import
    # costs low for callers that only probe.
    from mt_eval_harness.corpus_build.sampling import (
        _enrich_entry,
        _filter_by_word_count,
        _stratified_sample,
    )
    import random
    from collections import Counter

    full_recipe = {**DEFAULT_RECIPE, **(recipe or {})}
    if full_recipe.get("split") != "test":
        raise ValueError(
            f"Unsupported split '{full_recipe.get('split')}' — the "
            f"consolidated archive carries test splits only. Dev/train "
            f"extraction needs the per-pair tars (see tatoeba_adapter)."
        )

    tar_path = ensure_test_tar(
        cache_dir, url=tar_url, expected_sha256=tar_sha256, auto_yes=auto_yes,
    )

    # Resolve the tar folder holding this (src,tgt) — direct for normal pairs,
    # or the containing MACRO folder for member languages (nob/nno→nor,
    # hrv/srp/bos→hbs, zsm→msa). Deterministic from the sha-pinned tar, so the
    # harness's fetch-on-load reproduces the identical corpus. rows_to_raw_entries
    # then filters to the exact member direction.
    pair = resolve_member_folder(tar_path, source_lang, target_lang)
    rows = extract_pair_rows(tar_path, pair)
    raw_entries = rows_to_raw_entries(
        rows, source_lang, target_lang,
        variety_filter=full_recipe.get("variety_filter"),
    )

    length_unit = full_recipe.get("length_unit", "words")
    if length_unit == "words":
        filtered = _filter_by_word_count(
            raw_entries,
            int(full_recipe["min_words"]),
            int(full_recipe["max_words"]),
        )
        window = (f"{full_recipe['min_words']}–{full_recipe['max_words']} "
                  f"source word-count window")
    elif length_unit == "chars":
        lo, hi = int(full_recipe["min_chars"]), int(full_recipe["max_chars"])
        filtered = [e for e in raw_entries
                    if lo <= len(e.source_text) <= hi]
        window = f"{lo}–{hi} source character window"
    else:
        raise ValueError(
            f"Unknown recipe length_unit '{length_unit}' "
            f"(expected 'words' or 'chars')."
        )
    if not filtered:
        raise ValueError(
            f"All {len(raw_entries)} entries for {source_lang}→{target_lang} "
            f"fell outside the {window}."
        )

    enriched = [_enrich_entry(raw, "tatoeba_challenge") for raw in filtered]

    rng = random.Random(int(full_recipe["seed"]))
    sampled = _stratified_sample(
        enriched, int(full_recipe["max_entries"]), rng,
    )

    corpus = Corpus(
        corpus_id=f"tatoeba-{_normalise_lang(source_lang)}-"
                  f"{_normalise_lang(target_lang)}-dev",
        version=str(full_recipe["builder_version"]),
        language_pair={
            "source": _normalise_lang(source_lang),
            "target": _normalise_lang(target_lang),
        },
        segment="development",
        created=str(full_recipe["created"]),
        entry_count=len(sampled),
        domains=sorted({e.domain for e in sampled}),
        entries=sampled,
        provenance={
            "builder": "champollion-corpora-builder",
            "builder_version": str(full_recipe["builder_version"]),
            "source_adapter": "tatoeba_challenge",
            "release": str(full_recipe["release"]),
            "split": "test",
            "source_export_url": tar_url,
            "seed": int(full_recipe["seed"]),
            "length_unit": length_unit,
            "min_words": int(full_recipe["min_words"]),
            "max_words": int(full_recipe["max_words"]),
            "min_chars": int(full_recipe["min_chars"]),
            "max_chars": int(full_recipe["max_chars"]),
            "variety_filter": full_recipe.get("variety_filter"),
            "max_entries": int(full_recipe["max_entries"]),
            "license": "CC-BY-2.0",
            "source_url": "https://tatoeba.org",
        },
    )

    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    corpus.to_json(dest)
    logger.info(
        "Built %s→%s dev corpus: %d entries → %s",
        source_lang, target_lang, len(sampled), dest,
    )
    return dest


def domain_distribution(corpus_path: Path) -> dict[str, int]:
    """Per-domain entry counts of a built corpus (registry metadata)."""
    import json
    from collections import Counter

    data = json.loads(Path(corpus_path).read_text(encoding="utf-8"))
    return dict(Counter(e["domain"] for e in data["entries"]))
