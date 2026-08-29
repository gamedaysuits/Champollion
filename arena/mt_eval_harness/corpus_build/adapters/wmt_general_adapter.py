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
WMT General / News blind test-set fetch-from-source builder (sacreBLEU ``-t``).

The canonical WMT held-out blind test sets — ``newstest`` 2014–2021 (the WMT
*News Translation* task) and the *General MT* task sets 2022–2025 — fetched on
demand through sacreBLEU's pinned dataset registry (the
``sacrebleu -t <testset> -l <langpair> --echo src,ref`` mechanism, here via the
Python API ``DATASETS[testset].source/references``).

Why these matter (the structural-ceiling fix): ~93% of the runnable registry is
public DEV splits, forced HIGH / relative-only — they cannot rank ABSOLUTE
translation quality because every frontier model has very likely memorized them.
The WMT blind test sets are the field's clean held-out tier: each year's set was
the *blind* eval WMT systems were judged on that year. The oldest editions are
maximally memorized (HIGH), but the freshest (WMT24/25) are low-contamination
enough to rank on absolute quality. WMT25 was explicitly difficulty-sampled —
"Time to Stop Evaluating on Easy Test Sets" (Kocmi et al., ACL 2025;
https://aclanthology.org/2025.wmt-1.22/) — a verbatim endorsement of the
easy-slice doctrine this project already enforces.

Integrity model (three pins, defence in depth):

  1. **sacreBLEU VERSION** — the toolchain whose bundled dataset registry freezes
     which bytes a ``-t <testset>`` fetch returns. Recorded on each card and
     passed in as ``pinned_sacrebleu_version``; a version mismatch is WARNED, not
     fatal (pins 2 + 3 are the hard guarantees, so a newer sacreBLEU shipping
     byte-identical data stays usable; any ACTUAL drift trips the size/sha check
     loudly).
  2. **sacreBLEU's bundled per-archive md5** — sacreBLEU refuses to use a
     downloaded tarball whose md5 doesn't match its own pin. This is the upstream
     byte-freeze, enforced inside ``DATASETS[testset].source(...)``.
  3. **PER-PAIR BUILT sha256** — the sha of THIS adapter's deterministic output,
     verified by ``corpus_fetch._verify_sha256``. Catches any drift the md5
     wouldn't (e.g. a different sacreBLEU version that re-segmented the same
     source).

Reference policy: WMT ships a primary reference per segment (a few language pairs
carry extra references); we score against the FIRST / primary reference
(``ref[0]``, the standard sacreBLEU default) and write a single-reference
harness-json corpus. Empty source/target segments are dropped (rare in WMT). The
reference is always the TARGET side of the sacreBLEU langpair, so ``en-de`` →
eng→deu and ``de-en`` → deu→eng are distinct, honestly-directed corpora.

Loud-failure policy: a testset absent from the installed sacreBLEU (e.g. WMT25 on
a sacreBLEU that predates it), an unknown langpair, an empty build, or a size
that no longer matches the card all RAISE — a wrong corpus must never masquerade
as the pinned one.

Licensing: WMT test data is released for RESEARCH use; the references are
professionally produced but the sources/terms are NOT blanket-permissive. The
cards tag ``LicenseRef-WMT-Research-Use`` (commercial=false, redistribution=false)
so ``license_use.py`` keeps them out of every prize / commercial / API lane while
the research / relative-comparison lanes stay open. Champollion never hosts the
content — sacreBLEU fetches it from source on demand and caches it OUTSIDE the
tracked tree (its own ``$SACREBLEU`` / ``~/.sacrebleu`` dir).
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

#: The sacreBLEU release the per-pair shas were pinned against. Cards may carry
#: their own pin (download.revision='sacrebleu-<ver>'); this is the fallback used
#: when none is supplied, kept in lock-step with the pin pass that wrote the shas.
DEFAULT_SACREBLEU_VERSION = "2.6.0"


# ---------------------------------------------------------------------------
# sacreBLEU access (isolated so tests can monkeypatch the fetch off-network)
# ---------------------------------------------------------------------------

def installed_sacrebleu_version() -> str:
    """Version string of the installed sacreBLEU (or '' if unimportable)."""
    try:
        import sacrebleu

        return getattr(sacrebleu, "__version__", "") or ""
    except Exception:  # pragma: no cover - import guard
        return ""


def _maybe_redirect_cache(cache_dir: Path | None) -> None:
    """Best-effort: point sacreBLEU's raw-download cache at ``cache_dir``.

    sacreBLEU computes ``SACREBLEU_DIR`` from ``$SACREBLEU`` at import time, so
    this only takes effect when sacreBLEU has not been imported yet (the
    standalone pin path). In the harness — where sacreBLEU may already be
    imported — it falls back to sacreBLEU's default ``~/.sacrebleu``. Either
    location is OUTSIDE the tracked tree (the in-repo ``cache_dir`` is gitignored;
    ``~/.sacrebleu`` is in $HOME), so no corpus content is ever tracked.
    """
    if cache_dir and "SACREBLEU" not in os.environ:
        os.environ["SACREBLEU"] = str(cache_dir)


def fetch_segments(testset: str, langpair: str) -> list[tuple[str, str]]:
    """Return RAW aligned ``[(source, primary_reference), ...]`` for one WMT pair.

    Pulls the source + reference streams from sacreBLEU's pinned dataset
    (verifying the tarball md5 internally), pairs them positionally, and takes
    the PRIMARY reference (``ref[0]``, the sacreBLEU scoring default). Returns the
    raw segments verbatim — stripping + empty-dropping happen in
    ``build_corpus_file`` (the deterministic transform), so this stays a thin,
    monkeypatchable sacreBLEU wrapper.

    Raises:
        RuntimeError: the testset is not in the installed sacreBLEU (e.g. WMT25
            on a sacreBLEU that predates it) — with an actionable upgrade hint.
        ValueError: the langpair is not offered by the testset, or sacreBLEU
            returned misaligned source/reference streams.
    """
    try:
        from sacrebleu.dataset import DATASETS
    except Exception as exc:  # pragma: no cover - import guard
        raise RuntimeError(
            "sacreBLEU is required to fetch WMT test sets but could not be "
            f"imported ({exc}). Install it: pip install 'sacrebleu>=2.0'."
        ) from exc

    dataset = DATASETS.get(testset)
    if dataset is None:
        raise RuntimeError(
            f"sacreBLEU {installed_sacrebleu_version() or '?'} has no test set "
            f"'{testset}'. Newer WMT editions (e.g. WMT25) ship in later "
            f"sacreBLEU releases — upgrade sacreBLEU, then re-pin this card. "
            f"Known wmt testsets: "
            f"{sorted(k for k in DATASETS if k.startswith('wmt'))}."
        )
    if langpair not in dataset.langpairs:
        raise ValueError(
            f"WMT testset '{testset}' does not offer langpair '{langpair}'. "
            f"Offered: {sorted(dataset.langpairs)}."
        )

    sources = list(dataset.source(langpair))
    references = list(dataset.references(langpair))
    if len(sources) != len(references):
        raise ValueError(
            f"WMT {testset} {langpair}: sacreBLEU returned {len(sources)} "
            f"sources but {len(references)} reference rows — refusing to pair "
            f"misaligned streams."
        )

    pairs: list[tuple[str, str]] = []
    for src, refs in zip(sources, references):
        # references() yields a tuple/list of references per segment; the primary
        # reference (index 0) is the sacreBLEU scoring default.
        ref = refs[0] if isinstance(refs, (list, tuple)) else refs
        pairs.append((src or "", ref or ""))
    return pairs


# ---------------------------------------------------------------------------
# Harness fetch-on-miss entry point
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    testset: str,
    langpair: str,
    cache_dir: Path | None = None,
    domain: str = "news",
    expected_size: int | None = None,
    pinned_sacrebleu_version: str | None = None,
    auto_yes: bool = True,
) -> Path:
    """Rebuild one WMT General/News eval corpus into ``dest`` (harness-json).

    ``source_lang`` / ``target_lang`` are the PROJECT ISO codes (e.g. 'eng',
    'deu') used in the corpus header; ``testset`` is the sacreBLEU dataset id
    (e.g. 'wmt19') and ``langpair`` the sacreBLEU pair string (e.g. 'en-de') used
    to fetch. ``expected_size``, when set, is enforced; a mismatch RAISES rather
    than silently serving a drifted corpus.

    Output is deterministic (sacreBLEU file order, 1-based string ids, fixed JSON
    serialization), which is what makes the per-pair ``sha256`` reproducible and
    verifiable by ``corpus_fetch``.
    """
    _maybe_redirect_cache(cache_dir)

    # Version pin is documentation + a soft guard: sacreBLEU's own md5 (pin 2) and
    # the per-pair sha (pin 3) are the hard guarantees, so a version difference
    # that ships identical bytes must not block the build — but flag it.
    want_ver = (pinned_sacrebleu_version or DEFAULT_SACREBLEU_VERSION).strip()
    have_ver = installed_sacrebleu_version()
    if want_ver and have_ver and want_ver != have_ver:
        logger.warning(
            "WMT %s %s: card pins sacreBLEU %s but %s is installed. The "
            "per-pair sha (and any expected_size) will catch real data drift "
            "loudly; if the build succeeds the bytes are identical.",
            testset, langpair, want_ver, have_ver,
        )

    # Deterministic transform: strip each segment, drop any whose source or
    # reference is empty after stripping (rare in WMT). Done HERE (not in
    # fetch_segments) so it rides the same tested path the sha is pinned over.
    pairs = [
        (s, t)
        for raw_s, raw_t in fetch_segments(testset, langpair)
        for s, t in [((raw_s or "").strip(), (raw_t or "").strip())]
        if s and t
    ]
    if not pairs:
        raise ValueError(
            f"WMT {testset} {langpair} ({source_lang}→{target_lang}): no usable "
            f"segments after dropping empties — upstream data may have changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"WMT {testset} {langpair} ({source_lang}→{target_lang}): rebuilt "
            f"corpus has {len(pairs)} segments but the card declares "
            f"{expected_size}. The sacreBLEU dataset may have changed since the "
            f"card was pinned (installed sacreBLEU {have_ver or '?'}, card pins "
            f"{want_ver or '?'}) — re-pin the card (size + sha256) before "
            f"serving it."
        )

    entries = [
        {"source": s, "target": t, "id": str(i)}
        for i, (s, t) in enumerate(pairs, 1)
    ]
    corpus = {
        "source_lang": source_lang,
        "target_lang": target_lang,
        "entry_count": len(entries),
        "domain": domain,
        "source_dataset": f"{testset}-{langpair}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built WMT corpus %s %s (%s→%s, %d segments) at %s",
        testset, langpair, source_lang, target_lang, len(entries), dest,
    )
    return dest
