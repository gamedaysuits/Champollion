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
AraBench (QCRI) fetch-from-source builder.

Single home for everything needed to rebuild an AraBench dialectal-Arabic ↔
English eval corpus from upstream:

  * the public AraBench dataset archive URL (a single tar.gz),
  * the project ISO 639-3 ↔ AraBench dialect-tag map (the SSOT for this
    adapter's Arabic-dialect axis: MSA + Levantine/Gulf/Maghrebi/Egyptian),
  * the download / archive-sha verification of the .tgz, and
  * the per-dialect aggregation that concatenates every test file of one
    dialect (across sources/regions) into a single dialect↔English corpus,
    line-aligned on the parallel ``.ar`` / ``.en`` siblings.

Both the registry fetch-on-miss path (``mt_eval_harness.corpus_fetch``) and
this package's tests import from here, so the download/aggregation logic has
exactly one definition.

Loud-failure policy: this adapter never guesses and never silently
substitutes. An unknown dialect code, a non-dialect↔English pair, a missing
``.en`` sibling, a line-count mismatch between sibling files, an empty pair,
an archive whose sha no longer matches the pin, or a built pair whose size no
longer matches the card all raise — a wrong corpus must never masquerade as
the pinned one.

AraBench is a dialectal Arabic MT evaluation benchmark (Sajjad et al., 2020;
QCRI; http://alt.qcri.org/resources/mt/arabench/) distributed for
research/evaluation. License spdx is best described as "unknown-permissive"
here — the dataset is openly distributed by QCRI for evaluation, but this
adapter does NOT hardcode a license claim in its output; the registry/card
declares the final license. Domain is "mixed" (MADAR + Bible + QAraC).
"""

from __future__ import annotations

import hashlib
import json
import logging
import tarfile
import urllib.error
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — the SSOT for the AraBench upstream
# ---------------------------------------------------------------------------

ARABENCH_URL = (
    "http://alt.qcri.org/resources/mt/arabench/releases/current/"
    "AraBench_dataset.tgz"
)
ARCHIVE_NAME = "AraBench_dataset.tgz"
#: Files live at AraBench_dataset/{source}.{split}.{dialect}.{n}.{region}.{ar|en}
#: e.g. AraBench_dataset/madar.test.lev.0.sy.ar ↔ ...sy.en (line-aligned).
#: source ∈ {madar, bible, QAraC}; split ∈ {dev, test};
#: dialect ∈ {msa, lev, glf, mgr, nil}. ``.ids`` sidecars and macOS junk
#: members (basename starting ``._``) are ignored.
_MEMBER_GLOB = "AraBench_dataset/*.{segment}.{dialect}.*.ar"
DOMAIN = "mixed"

#: Identifying agent so the upstream maintainers can attribute the traffic
#: (founder directive: always make Champollion's corpus pulls attributable).
USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

#: The English pivot side. AraBench only has dialect↔English, so English is
#: always one half of every pair and lives on the ``.en`` side of each file.
ENGLISH_ISO = "eng"

# Project ISO 639-3 (the codes the cards/registry use) → AraBench dialect tag
# (the ``{dialect}`` in {source}.{split}.{dialect}.{n}.{region}.ar). This is
# the SSOT for the adapter's Arabic-dialect axis; English is the pivot and is
# not in this map (it has no dialect tag — it is the ``.en`` side of a file).
ARABENCH_DIALECT_MAP = {
    "arb": "msa",  # Modern Standard Arabic
    "apc": "lev",  # North Levantine Arabic (Levantine)
    "afb": "glf",  # Gulf Arabic
    "ary": "mgr",  # Moroccan / Maghrebi Arabic
    "arz": "nil",  # Egyptian / Nile-Valley Arabic
}


def iso3_to_arabench_dialect(code: str) -> str:
    """Map a project ISO 639-3 code to its AraBench dialect tag.

    Accepts an already-AraBench dialect tag too (idempotent). Raises — never
    guesses — when the code isn't a known Arabic-dialect ISO code or tag, so a
    typo can't aggregate the wrong dialect.
    """
    if code in ARABENCH_DIALECT_MAP:
        return ARABENCH_DIALECT_MAP[code]
    if code in ARABENCH_DIALECT_MAP.values():
        return code
    raise ValueError(
        f"No AraBench dialect tag for language '{code}'. Known dialect ISO "
        f"codes: {sorted(ARABENCH_DIALECT_MAP)} (tags "
        f"{sorted(ARABENCH_DIALECT_MAP.values())}). AraBench only carries "
        f"these Arabic dialects; English is the pivot side ('{ENGLISH_ISO}')."
    )


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download_archive(cache_dir: Path, archive_sha256: str | None = None) -> Path:
    """Download (and cache) the AraBench dataset tgz, verifying its sha.

    A cached archive that still matches ``archive_sha256`` is reused. A
    cached archive that fails verification is re-downloaded once. A fresh
    download that fails verification raises rather than serving an archive
    that no longer matches the pin.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    archive = cache_dir / ARCHIVE_NAME

    if archive.exists():
        if not archive_sha256 or _sha256_file(archive) == archive_sha256:
            return archive
        logger.warning("Cached AraBench archive failed sha verification — "
                       "re-downloading")

    logger.info("Downloading %s", ARABENCH_URL)
    req = urllib.request.Request(ARABENCH_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()

    if archive_sha256:
        actual = hashlib.sha256(data).hexdigest()
        if actual != archive_sha256:
            raise ValueError(
                f"AraBench archive sha mismatch:\n  Expected: {archive_sha256}\n"
                f"  Got:      {actual}\n  Upstream {ARABENCH_URL} may have "
                f"changed since the card was pinned — re-verify the card's "
                f"download.sha256."
            )
    archive.write_bytes(data)
    return archive


# ---------------------------------------------------------------------------
# Parse + aggregate
# ---------------------------------------------------------------------------

def _basename(member_name: str) -> str:
    return member_name.rsplit("/", 1)[-1]


def _read_member_lines(tf: tarfile.TarFile, name: str) -> list[str]:
    """Read one tar member → list of UTF-8 lines (no trailing newline split)."""
    extracted = tf.extractfile(name)
    if extracted is None:
        raise FileNotFoundError(
            f"AraBench archive member '{name}' could not be read (not a "
            f"regular file). The archive layout may have changed upstream; "
            f"re-pin the card."
        )
    with extracted:
        text = extracted.read().decode("utf-8")
    # splitlines() drops the trailing empty element a final newline produces.
    return text.splitlines()


def collect_dialect_pairs(
    tf: tarfile.TarFile,
    dialect_tag: str,
    segment: str,
) -> list[tuple[str, str]]:
    """Return aggregated ``[(ar_line, en_line), ...]`` for one dialect.

    Finds every ``.ar`` member of ``dialect_tag`` in ``segment`` (across
    sources/regions), ignoring ``.ids`` sidecars and macOS junk members whose
    basename starts with ``._``; sorts them by member name for a stable order;
    and for each reads it plus its sibling ``.en`` (identical prefix). A
    missing sibling raises FileNotFoundError; a per-file line-count mismatch
    asserts. Lines are stripped and pairs where either side is empty are
    dropped. Returns Arabic-on-the-left, English-on-the-right; the caller
    orients per direction.
    """
    pattern = _MEMBER_GLOB.format(segment=segment, dialect=dialect_tag)

    ar_members: list[str] = []
    for member in tf.getmembers():
        if not member.isfile():
            continue
        name = member.name
        base = _basename(name)
        if base.startswith("._"):  # macOS resource-fork junk.
            continue
        # fnmatch-style match on the full member path against the glob.
        if not Path(name).match(pattern):
            continue
        ar_members.append(name)

    ar_members.sort()

    pairs: list[tuple[str, str]] = []
    for ar_name in ar_members:
        en_name = ar_name[: -len(".ar")] + ".en"
        en_base = _basename(en_name)
        try:
            tf.getmember(en_name)
        except KeyError:
            raise FileNotFoundError(
                f"AraBench: .ar member '{ar_name}' has no sibling .en "
                f"('{en_name}'). The pair is not line-aligned upstream; "
                f"re-pin the card."
            )
        # Skip a junk-prefixed sibling name out of caution (it would not have
        # been written as a real sibling, but be explicit).
        if en_base.startswith("._"):
            raise FileNotFoundError(
                f"AraBench: sibling .en for '{ar_name}' resolves to a junk "
                f"member '{en_name}'."
            )

        ar_lines = _read_member_lines(tf, ar_name)
        en_lines = _read_member_lines(tf, en_name)
        assert len(ar_lines) == len(en_lines), (
            f"AraBench: line-count mismatch between '{ar_name}' "
            f"({len(ar_lines)}) and '{en_name}' ({len(en_lines)}) — the "
            f"sibling files are not line-aligned upstream."
        )

        for ar_line, en_line in zip(ar_lines, en_lines):
            ar_s, en_s = ar_line.strip(), en_line.strip()
            if not ar_s or not en_s:
                continue
            pairs.append((ar_s, en_s))

    return pairs


# ---------------------------------------------------------------------------
# Harness fetch-on-miss entry point
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    cache_dir: Path,
    archive_sha256: str | None = None,
    segment: str = "test",
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one AraBench eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO 639-3 codes (from the
    registry entry's ``language_pair``). Exactly one side must be English
    ('eng') and the other one of the five Arabic-dialect ISO codes — anything
    else raises ValueError (AraBench only has dialect↔English). Both
    directions are built from the same files:

      * eng → <dialect> : source = English (.en), target = Arabic (.ar).
      * <dialect> → eng : source = Arabic (.ar), target = English (.en).

    ``expected_size``, when given (the card's declared size), is enforced: a
    built pair of a different size raises rather than serving data that no
    longer matches the pinned card.
    """
    src_is_eng = source_lang == ENGLISH_ISO
    tgt_is_eng = target_lang == ENGLISH_ISO
    if src_is_eng == tgt_is_eng:
        # Both English or neither English — not a dialect↔English pair.
        raise ValueError(
            f"AraBench only has dialect↔English pairs: exactly one of "
            f"source_lang='{source_lang}' / target_lang='{target_lang}' must "
            f"be '{ENGLISH_ISO}' and the other a dialect ISO code "
            f"{sorted(ARABENCH_DIALECT_MAP)}."
        )

    dialect_iso = target_lang if src_is_eng else source_lang
    dialect_tag = iso3_to_arabench_dialect(dialect_iso)

    archive = download_archive(cache_dir, archive_sha256)
    with tarfile.open(archive, "r:gz") as tf:
        ar_en_pairs = collect_dialect_pairs(tf, dialect_tag, segment)

    if not ar_en_pairs:
        raise ValueError(
            f"AraBench {source_lang}→{target_lang} ({segment}): no aligned "
            f"sentences for dialect '{dialect_tag}'. Upstream data may have "
            f"changed."
        )

    # Orient per direction. collect_dialect_pairs returns (ar, en).
    if src_is_eng:  # eng → dialect: English source, Arabic target.
        oriented = [(en, ar) for ar, en in ar_en_pairs]
    else:  # dialect → eng: Arabic source, English target.
        oriented = [(ar, en) for ar, en in ar_en_pairs]

    if expected_size is not None and len(oriented) != expected_size:
        raise ValueError(
            f"AraBench {source_lang}→{target_lang}: rebuilt pair has "
            f"{len(oriented)} sentences but the card declares {expected_size}. "
            f"Upstream AraBench data may have changed since the card was "
            f"pinned — re-pin the card (and any sha256) before serving it."
        )

    entries = [
        {"source": s, "target": t, "id": str(i)}
        for i, (s, t) in enumerate(oriented, 1)
    ]
    corpus = {
        "source_lang": source_lang,
        "target_lang": target_lang,
        "entry_count": len(entries),
        "domain": DOMAIN,
        "source_dataset": f"arabench-{segment}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built AraBench corpus %s→%s (%d entries) at %s",
        source_lang, target_lang, len(entries), dest,
    )
    return dest
