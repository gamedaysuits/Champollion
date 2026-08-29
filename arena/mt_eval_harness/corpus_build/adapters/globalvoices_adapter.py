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
GlobalVoices (OPUS v2018q4) fetch-from-source builder adapter.

Single home for everything needed to rebuild a GlobalVoices eval corpus
from upstream:

  * the OPUS object-storage URL pattern,
  * the ISO 639-1 (OPUS convention) ↔ ISO 639-3 (project convention) map,
  * the download/parse of Moses-format parallel zips, and
  * the deterministic tail test-split the eval cards pin.

Both the card generator (``build_all_globalvoices``) and the harness
fetch-on-miss path (``mt_eval_harness.corpus_fetch``) import from here, so
the download/split logic has exactly one definition.

Loud-failure policy: this adapter never guesses and never silently
substitutes. An unknown language code, a missing pair, an empty split, or a
split whose size no longer matches the card all raise — a wrong corpus must
never masquerade as the pinned one.

GlobalVoices is citizen journalism translated by volunteers, CC-BY-4.0,
"news" domain (https://globalvoices.org/ via OPUS).
"""

from __future__ import annotations

import io
import json
import logging
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — the SSOT for the GlobalVoices upstream
# ---------------------------------------------------------------------------

FLOOR_N = 100              # Minimum sentences for a viable eval pair
DEFAULT_TEST_SPLIT_N = 2000  # Tail split size (take last N sentences)
OPUS_VERSION = "v2018q4"
OPUS_BASE_URL = (
    f"https://object.pouta.csc.fi/OPUS-GlobalVoices/{OPUS_VERSION}/moses"
)

# All language codes available in GlobalVoices v2018q4 on OPUS, ISO 639-1
# (OPUS convention). Sourced from the OPUS language matrix for this corpus.
GLOBALVOICES_LANGS = [
    "am", "ar", "ay", "bg", "bn", "ca", "cs", "da", "de", "el",
    "en", "eo", "es", "fa", "fil", "fr", "he", "hi", "hu", "id",
    "it", "ja", "ka", "km", "ko", "ku", "mg", "mk", "mn", "mr",
    "ms", "my", "ne", "nl", "pl", "pt", "ro", "ru", "sq", "sr",
    "sv", "sw", "ta", "te", "tl", "tr", "uk", "ur", "vi", "zh",
]

# ISO 639-1 (OPUS convention) → ISO 639-3 (project convention).
# This is the SSOT mapping for the GlobalVoices code bridge.
GV_CODE_MAP = {
    "am": "amh", "ar": "arb", "ay": "aym", "bg": "bul", "bn": "ben",
    "ca": "cat", "cs": "ces", "da": "dan", "de": "deu", "el": "ell",
    "en": "eng", "eo": "epo", "es": "spa", "fa": "fas", "fil": "fil",
    "fr": "fra", "he": "heb", "hi": "hin", "hu": "hun", "id": "ind",
    "it": "ita", "ja": "jpn", "ka": "kat", "km": "khm", "ko": "kor",
    "ku": "kur", "mg": "mlg", "mk": "mkd", "mn": "mon", "mr": "mar",
    "ms": "zsm", "my": "mya", "ne": "npi", "nl": "nld", "pl": "pol",
    "pt": "por", "ro": "ron", "ru": "rus", "sq": "sqi", "sr": "srp",
    "sv": "swe", "sw": "swh", "ta": "tam", "te": "tel", "tl": "tgl",
    "tr": "tur", "uk": "ukr", "ur": "urd", "vi": "vie", "zh": "cmn",
}

# Reverse: ISO 639-3 → ISO 639-1. Built once; asserted 1:1 so a duplicate
# project code can never silently shadow another at import time.
GV_CODE_MAP_REVERSE: dict[str, str] = {}
for _opus, _iso3 in GV_CODE_MAP.items():
    if _iso3 in GV_CODE_MAP_REVERSE:
        raise RuntimeError(
            f"GV_CODE_MAP is not 1:1 — ISO 639-3 '{_iso3}' maps from both "
            f"'{GV_CODE_MAP_REVERSE[_iso3]}' and '{_opus}'. The reverse "
            f"lookup would be ambiguous; fix the map."
        )
    GV_CODE_MAP_REVERSE[_iso3] = _opus


def iso3_to_opus(code: str) -> str:
    """Map a project ISO 639-3 code to its OPUS GlobalVoices file code.

    Accepts an already-OPUS code too (idempotent). Raises — never guesses —
    when the code isn't in the bridge, so a typo can't fetch the wrong file.
    """
    if code in GV_CODE_MAP_REVERSE:
        return GV_CODE_MAP_REVERSE[code]
    if code in GV_CODE_MAP:
        return code
    raise ValueError(
        f"No OPUS GlobalVoices code for language '{code}'. Known project "
        f"codes: {sorted(GV_CODE_MAP_REVERSE)}. If OPUS GlobalVoices "
        f"{OPUS_VERSION} carries this language, add it to GV_CODE_MAP."
    )


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------

def download_pair(
    src: str, tgt: str, cache_dir: Path,
) -> tuple[list[str], list[str]] | None:
    """Download one GlobalVoices pair from OPUS, in OPUS (639-1) codes.

    Returns ``(source_lines, target_lines)`` aligned by line, or ``None``
    when OPUS has no such pair (HTTP 404). Network/parse failures other than
    404 propagate — we do not silently treat an outage as "pair absent".
    Results are cached under ``cache_dir`` keyed by the alphabetical pair.
    """
    if src > tgt:
        src, tgt = tgt, src
        swapped = True
    else:
        swapped = False

    cache_file = cache_dir / f"{src}-{tgt}.json"
    if cache_file.exists():
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        src_lines, tgt_lines = data["src"], data["tgt"]
        if swapped:
            src_lines, tgt_lines = tgt_lines, src_lines
        return src_lines, tgt_lines

    url = f"{OPUS_BASE_URL}/{src}-{tgt}.txt.zip"
    logger.info("Downloading %s", url)
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=120) as resp:
            zip_data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            logger.info("OPUS has no GlobalVoices pair %s-%s (404)", src, tgt)
            return None
        raise  # 5xx / auth / etc. — loud, not "absent"

    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        names = zf.namelist()
        src_match = [n for n in names if n.endswith(f".{src}")]
        tgt_match = [n for n in names if n.endswith(f".{tgt}")]
        if not src_match or not tgt_match:
            raise ValueError(
                f"GlobalVoices zip for {src}-{tgt} is missing a side: "
                f"members={names}. Expected files ending '.{src}' and '.{tgt}'."
            )
        src_text = zf.read(src_match[0]).decode("utf-8")
        tgt_text = zf.read(tgt_match[0]).decode("utf-8")

    src_lines = [l.strip() for l in src_text.strip().split("\n") if l.strip()]
    tgt_lines = [l.strip() for l in tgt_text.strip().split("\n") if l.strip()]
    # Align to the shorter side (a ragged tail would misalign every pair).
    min_len = min(len(src_lines), len(tgt_lines))
    src_lines, tgt_lines = src_lines[:min_len], tgt_lines[:min_len]

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(
        json.dumps({"src": src_lines, "tgt": tgt_lines}), encoding="utf-8"
    )

    if swapped:
        src_lines, tgt_lines = tgt_lines, src_lines
    return src_lines, tgt_lines


def make_test_split(
    src_lines: list[str],
    tgt_lines: list[str],
    tail_n: int = DEFAULT_TEST_SPLIT_N,
) -> tuple[list[str], list[str]]:
    """Deterministic tail split: the last ``tail_n`` aligned sentences.

    Using the tail avoids overlap with training data that typically draws
    from the head; the split is reproducible because the upstream OPUS
    release is frozen.
    """
    n = min(len(src_lines), tail_n)
    return src_lines[-n:], tgt_lines[-n:]


# ---------------------------------------------------------------------------
# Harness fetch-on-miss entry point
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    cache_dir: Path,
    recipe: dict | None = None,
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one GlobalVoices eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO 639-3 codes (from the
    card's ``pair``). ``recipe`` is the card's ``source.recipe`` (selects the
    split). ``expected_size``, when given (the card's declared size), is
    enforced: a built split of a different size raises rather than serving
    data that no longer matches the pinned card.
    """
    recipe = recipe or {}
    split = recipe.get("split", "test")
    if split != "test":
        raise ValueError(
            f"GlobalVoices adapter only knows the 'test' tail split; card "
            f"recipe asked for split='{split}'."
        )
    tail_n = int(recipe.get("tail_n", DEFAULT_TEST_SPLIT_N))

    src_opus = iso3_to_opus(source_lang)
    tgt_opus = iso3_to_opus(target_lang)

    result = download_pair(src_opus, tgt_opus, cache_dir)
    if result is None:
        raise FileNotFoundError(
            f"OPUS GlobalVoices {OPUS_VERSION} has no pair "
            f"{source_lang}-{target_lang} ({src_opus}-{tgt_opus}). "
            f"Checked {OPUS_BASE_URL}/{min(src_opus, tgt_opus)}-"
            f"{max(src_opus, tgt_opus)}.txt.zip."
        )

    src_lines, tgt_lines = result
    test_src, test_tgt = make_test_split(src_lines, tgt_lines, tail_n)
    if not test_src:
        raise ValueError(
            f"GlobalVoices {source_lang}-{target_lang}: empty test split "
            f"(downloaded {len(src_lines)} aligned sentences)."
        )

    if expected_size is not None and len(test_src) != expected_size:
        raise ValueError(
            f"GlobalVoices {source_lang}-{target_lang}: rebuilt test split has "
            f"{len(test_src)} sentences but the card declares {expected_size}. "
            f"Upstream OPUS data may have changed since the card was pinned — "
            f"re-pin the card (and any sha256) before serving this corpus."
        )

    entries = [
        {"source": s, "target": t, "id": str(i)}
        for i, (s, t) in enumerate(zip(test_src, test_tgt), 1)
    ]
    corpus = {
        "source_lang": source_lang,
        "target_lang": target_lang,
        "entry_count": len(entries),
        "domain": "news",
        "source_dataset": f"globalvoices-{OPUS_VERSION}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built GlobalVoices corpus %s→%s (%d entries) at %s",
        source_lang, target_lang, len(entries), dest,
    )
    return dest
