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
Generic line-parallel fetch-from-source builder adapter ("recipes, not adapters").

One transport implementation for the most common shared-task/benchmark shapes:
line-aligned text files fetched from a pinned GitHub commit. The default
pairing is two files (source + reference) zipped line-by-line; a recipe may
instead declare a single-file ``pairing`` mode (see PAIRING MODES below) for
benchmarks that ship both sides in one TSV/CSV/JSON file. Everything
benchmark-specific rides DATA (the corpora-card `download` block + a recipe
JSON), not code:

  * ``repo_url``      — the upstream GitHub repo (or bare ``org/name``),
  * ``revision``      — an immutable commit sha (the integrity anchor; every
                        file is fetched from ``raw.githubusercontent.com/
                        {repo}/{revision}/…``, so rebuilds are byte-stable),
  * ``file_pattern``  — a member-path template resolved per side with the
                        placeholders ``{lang_code}`` (the side's own upstream
                        code), ``{src_code}`` and ``{tgt_code}`` (the pair's
                        codes — for per-pair directory layouts like
                        ``data/{src_code}-{tgt_code}/test.{lang_code}``),
  * ``dataset_tag``   — the family token stamped into the built corpus's
                        ``source_dataset`` (e.g. ``americasnlp2021``); part of
                        the built bytes, so it is pinned by the card's sha.

PAIRING MODES (``pairing.mode`` on the recipe/card ``download`` block,
2026-07-07 extension; absent = ``line-zip``, the original two-file default):

  * ``line-zip``     — two line-aligned files, zipped row-for-row (default;
                       existing cards' built bytes are unchanged),
  * ``tsv-columns``  — ONE tab-separated file; each side is a column selected
                       via ``pairing.columns`` (MENYO-20k's 2-col TSV),
  * ``csv-columns``  — ONE RFC-4180 CSV (quoting, embedded newlines); each
                       side is a column (NusaX's 12-language multi-parallel
                       CSV, NusaTranslation's per-language 3-col CSVs),
  * ``json-fields``  — ONE JSON file; records are located by
                       ``pairing.recordPath`` and each side is a record field
                       selected via ``pairing.fields`` (BSD's doc-level
                       dialogue JSON, flattened in document order).

``pairing.columns`` / ``pairing.fields`` map each side's upstream lang code
(``src_code``/``tgt_code``) to its column header name (or 0-based index) /
field name — both sides come from the SAME row/record, so single-file modes
cannot misalign. Single-file member paths resolve ``file_pattern`` with
``{src_code}``/``{tgt_code}`` only (``{lang_code}`` is ambiguous and refused).

Loud-failure policy (the SMOL/AmericasNLP doctrine): a missing file, a
line-count mismatch between the two halves, a missing column/field in a
declared pairing, an empty built pair, or a size that no longer matches the
pinned card all raise — never guess, never silently substitute.

Champollion never hosts the content: files are fetched from the pinned
upstream into a gitignored cache and rebuilt deterministically. The built
corpus JSON layout is frozen (source_lang, target_lang, entry_count, domain,
source_dataset, entries) — changing it would invalidate every pinned sha.

History: generalized 2026-07-07 from ``americasnlp_adapter`` (which is now a
thin compatibility shim over this module) as master-plan workstream A1.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import urllib.error
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

#: The pairing modes this transport supports (``pairing.mode``). ``line-zip``
#: is the two-file default every pre-existing card implicitly uses; the other
#: three pair columns/fields of ONE downloaded file.
PAIRING_MODES = ("line-zip", "tsv-columns", "csv-columns", "json-fields")


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def _repo_id(repo_url: str) -> str:
    """Extract ``org/name`` from a GitHub URL, or pass through a bare id."""
    marker = "github.com/"
    if marker in repo_url:
        tail = repo_url.split(marker, 1)[1]
        parts = [p for p in tail.split("/") if p]
        if len(parts) < 2:
            raise ValueError(
                f"Cannot extract org/repo from GitHub URL '{repo_url}'."
            )
        return f"{parts[0]}/{parts[1].removesuffix('.git')}"
    return repo_url.strip("/")


def _resolve_member(
    file_pattern: str, *, lang_code: str, src_code: str, tgt_code: str,
) -> str:
    """Fill the member-path template for one side of the pair."""
    try:
        return file_pattern.format(
            lang_code=lang_code, src_code=src_code, tgt_code=tgt_code,
        )
    except KeyError as e:
        raise ValueError(
            f"file_pattern '{file_pattern}' uses unknown placeholder {e} — "
            f"supported: {{lang_code}}, {{src_code}}, {{tgt_code}}."
        )


def download_split_file(
    cache_dir: Path,
    member: str,
    *,
    repo_url: str,
    revision: str,
) -> Path:
    """Download (and cache) one member file from the pinned commit.

    The commit ``revision`` makes the bytes immutable, so the cache key is
    ``{revision}__{member with / → __}`` and a cached file is trusted as-is.
    """
    if not revision:
        raise ValueError(
            "line-parallel fetch requires a pinned commit revision — refusing "
            "to fetch from a moving branch."
        )
    cache_dir.mkdir(parents=True, exist_ok=True)
    repo = _repo_id(repo_url)
    local = cache_dir / f"{revision}__{member.replace('/', '__')}"

    if local.exists():
        return local

    url = f"https://raw.githubusercontent.com/{repo}/{revision}/{member}"
    logger.info("Downloading %s", url)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise FileNotFoundError(
                f"Repo {repo} has no file '{member}' at revision {revision} — "
                f"the language code or file pattern on the card/recipe does "
                f"not match the upstream layout."
            )
        raise

    local.write_bytes(data)
    return local


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build_pair(
    src_path: Path, tgt_path: Path, *, src_code: str, tgt_code: str,
) -> list[tuple[str, str]]:
    """Pair the two line-aligned halves into ``[(source, target), ...]``.

    The upstream files are strictly line-parallel; a length mismatch means
    the two files are not two halves of the same split, so it raises rather
    than misalign. Pairs where either side is empty are dropped.
    """
    src_lines = src_path.read_text(encoding="utf-8").split("\n")
    tgt_lines = tgt_path.read_text(encoding="utf-8").split("\n")
    # A trailing newline yields trailing "" entries — trim them symmetrically,
    # but treat any remaining count divergence as a real mismatch.
    while src_lines and not src_lines[-1].strip():
        src_lines.pop()
    while tgt_lines and not tgt_lines[-1].strip():
        tgt_lines.pop()
    if len(src_lines) != len(tgt_lines):
        raise ValueError(
            f"line-parallel {src_code}→{tgt_code}: line count mismatch "
            f"({src_path.name}: {len(src_lines)} vs {tgt_path.name}: "
            f"{len(tgt_lines)}) — the files are not line-parallel halves of "
            f"one split; refusing to pair them."
        )

    pairs = []
    for s, t in zip(src_lines, tgt_lines):
        s, t = s.strip(), t.strip()
        if s and t:
            pairs.append((s, t))
    return pairs


# ---------------------------------------------------------------------------
# Single-file pairing modes (tsv-columns / csv-columns / json-fields)
# ---------------------------------------------------------------------------

def _resolve_single_member(
    file_pattern: str, *, src_code: str, tgt_code: str,
) -> str:
    """Resolve the ONE member path a single-file pairing mode fetches.

    Only ``{src_code}``/``{tgt_code}`` are meaningful when both sides live in
    the same file; ``{lang_code}`` (or any other placeholder) is ambiguous
    and refused rather than guessed.
    """
    try:
        return file_pattern.format(src_code=src_code, tgt_code=tgt_code)
    except KeyError as e:
        raise ValueError(
            f"file_pattern '{file_pattern}' uses placeholder {e}, but "
            f"single-file pairing modes resolve ONE member for both sides — "
            f"only {{src_code}} and {{tgt_code}} are supported "
            f"(not {{lang_code}})."
        )


def _pairing_selector(pairing: dict, key: str, code: str):
    """Look up one side's column/field selector from the pairing config."""
    table = pairing.get(key)
    if not isinstance(table, dict) or not table:
        raise ValueError(
            f"pairing mode '{pairing.get('mode')}' requires a non-empty "
            f"'{key}' map (upstream lang code → column header/index or "
            f"field name)."
        )
    if code not in table:
        raise ValueError(
            f"pairing.{key} has no entry for upstream code '{code}' — "
            f"declared codes: {sorted(table)}. Never guess a column/field."
        )
    return table[code]


def _column_index(selector, header: list[str] | None, *, member: str) -> int:
    """Resolve a column selector (header name or 0-based int) to an index."""
    if isinstance(selector, int) and not isinstance(selector, bool):
        return selector
    if header is None:
        raise ValueError(
            f"{member}: column selector {selector!r} is a header name but "
            f"pairing.hasHeader is false — headerless files must select "
            f"columns by 0-based integer index."
        )
    stripped = [h.strip() for h in header]
    if selector not in stripped:
        raise ValueError(
            f"{member}: column '{selector}' not found in header "
            f"{stripped} — the file layout at the pinned revision does not "
            f"match the recipe's pairing.columns."
        )
    return stripped.index(selector)


def build_pairs_from_columns(
    path: Path, *, pairing: dict, src_code: str, tgt_code: str,
) -> list[tuple[str, str]]:
    """Pair two columns of ONE tabular file (tsv-columns / csv-columns).

    Both sides come from the same row, so misalignment is impossible; the
    loud failures here are structural instead — a missing header name or a
    row too short for a selected column means the upstream layout changed.
    Fully-empty rows carry no data and are skipped; rows where either
    selected cell strips to empty are dropped (the line-zip convention).
    """
    mode = pairing["mode"]
    text = path.read_text(encoding="utf-8")
    if mode == "csv-columns":
        rows = [r for r in csv.reader(io.StringIO(text)) if r]
    else:  # tsv-columns — plain tab split, no quoting dialect
        rows = [l.split("\t") for l in text.split("\n") if l.strip()]

    has_header = pairing.get("hasHeader", True)
    header = rows[0] if (has_header and rows) else None
    data_rows = rows[1:] if has_header else rows
    src_idx = _column_index(
        _pairing_selector(pairing, "columns", src_code), header,
        member=path.name,
    )
    tgt_idx = _column_index(
        _pairing_selector(pairing, "columns", tgt_code), header,
        member=path.name,
    )

    pairs = []
    for n, row in enumerate(data_rows, 2 if has_header else 1):
        if len(row) <= max(src_idx, tgt_idx):
            raise ValueError(
                f"{path.name} row {n}: {len(row)} columns but the pairing "
                f"selects index {max(src_idx, tgt_idx)} — the file is not "
                f"column-parallel at the pinned revision; refusing to pair."
            )
        s, t = row[src_idx].strip(), row[tgt_idx].strip()
        if s and t:
            pairs.append((s, t))
    return pairs


def _iter_json_records(node, record_path: list, *, member: str):
    """Walk ``recordPath`` ('[]' descends into each list element) to records."""
    if not record_path:
        yield node
        return
    head, rest = record_path[0], record_path[1:]
    if head == "[]":
        if not isinstance(node, list):
            raise ValueError(
                f"{member}: pairing.recordPath expects a list at '[]' but "
                f"found {type(node).__name__} — the JSON layout at the "
                f"pinned revision does not match the recipe."
            )
        for item in node:
            yield from _iter_json_records(item, rest, member=member)
    else:
        if not isinstance(node, dict) or head not in node:
            raise ValueError(
                f"{member}: pairing.recordPath key '{head}' missing "
                f"(found {sorted(node) if isinstance(node, dict) else type(node).__name__}) "
                f"— the JSON layout at the pinned revision does not match "
                f"the recipe."
            )
        yield from _iter_json_records(node[head], rest, member=member)


def build_pairs_from_json(
    path: Path, *, pairing: dict, src_code: str, tgt_code: str,
) -> list[tuple[str, str]]:
    """Pair two fields of each record in ONE JSON file (json-fields).

    Records are located by ``pairing.recordPath`` and flattened in file
    order (deterministic — e.g. BSD's per-document dialogue turns). A record
    missing a declared field is a structural upstream change and raises.
    """
    src_field = _pairing_selector(pairing, "fields", src_code)
    tgt_field = _pairing_selector(pairing, "fields", tgt_code)
    record_path = pairing.get("recordPath")
    if not isinstance(record_path, list):
        raise ValueError(
            "pairing mode 'json-fields' requires 'recordPath' (a list of "
            "keys; '[]' descends into each list element)."
        )
    data = json.loads(path.read_text(encoding="utf-8"))

    pairs = []
    for rec in _iter_json_records(data, record_path, member=path.name):
        if not isinstance(rec, dict):
            raise ValueError(
                f"{path.name}: pairing.recordPath resolved a "
                f"{type(rec).__name__}, not an object record."
            )
        missing = [f for f in (src_field, tgt_field) if f not in rec]
        if missing:
            raise ValueError(
                f"{path.name}: record is missing declared field(s) "
                f"{missing} (record keys: {sorted(rec)}) — the JSON layout "
                f"at the pinned revision does not match the recipe."
            )
        s, t = str(rec[src_field]).strip(), str(rec[tgt_field]).strip()
        if s and t:
            pairs.append((s, t))
    return pairs


def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    src_code: str,
    tgt_code: str,
    cache_dir: Path,
    repo_url: str,
    revision: str,
    dataset_tag: str,
    file_pattern: str,
    domain: str = "conv",
    expected_size: int | None = None,
    auto_yes: bool = False,
    src_member: str | None = None,
    tgt_member: str | None = None,
    pairing: dict | None = None,
) -> Path:
    """Rebuild one line-parallel eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO codes (labels only).
    ``src_code``/``tgt_code`` are the upstream file codes (``es``, ``quy``, …)
    that resolve the split files via ``file_pattern`` and orient the pair.
    ``dataset_tag`` is the family token stamped into ``source_dataset``.
    ``expected_size``, when given, is enforced (the card's per-pair pin).
    ``src_member``/``tgt_member`` are explicit member-path escape hatches for
    upstreams whose filenames defy one template (e.g. LoResMT-2020's
    ``rui2hi.test.ru`` typo) — when given they override ``file_pattern``
    for that side only (two-file mode only).
    ``pairing`` selects the pairing mode (see module docstring); absent or
    ``mode: "line-zip"`` is the original two-file behaviour, byte-identical
    for every pre-existing card.
    """
    mode = (pairing or {}).get("mode") or "line-zip"
    if mode not in PAIRING_MODES:
        raise ValueError(
            f"Unknown pairing mode '{mode}' — supported: {PAIRING_MODES}."
        )

    if mode == "line-zip":
        src_member = src_member or _resolve_member(
            file_pattern, lang_code=src_code, src_code=src_code,
            tgt_code=tgt_code,
        )
        tgt_member = tgt_member or _resolve_member(
            file_pattern, lang_code=tgt_code, src_code=src_code,
            tgt_code=tgt_code,
        )
        src_path = download_split_file(
            cache_dir, src_member, repo_url=repo_url, revision=revision,
        )
        tgt_path = download_split_file(
            cache_dir, tgt_member, repo_url=repo_url, revision=revision,
        )
        pairs = build_pair(
            src_path, tgt_path, src_code=src_code, tgt_code=tgt_code,
        )
    else:
        if src_member or tgt_member:
            raise ValueError(
                f"srcMember/tgtMember are two-file (line-zip) escape "
                f"hatches and do not apply to pairing mode '{mode}' — use "
                f"a per-pair filePattern instead."
            )
        member = _resolve_single_member(
            file_pattern, src_code=src_code, tgt_code=tgt_code,
        )
        path = download_split_file(
            cache_dir, member, repo_url=repo_url, revision=revision,
        )
        if mode == "json-fields":
            pairs = build_pairs_from_json(
                path, pairing=pairing, src_code=src_code, tgt_code=tgt_code,
            )
        else:
            pairs = build_pairs_from_columns(
                path, pairing=pairing, src_code=src_code, tgt_code=tgt_code,
            )
    if not pairs:
        raise ValueError(
            f"{dataset_tag} {source_lang}→{target_lang} "
            f"({src_code}→{tgt_code}): empty pair — upstream data may have "
            f"changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"{dataset_tag} {source_lang}→{target_lang} "
            f"({src_code}→{tgt_code}): rebuilt pair has {len(pairs)} "
            f"sentences but the card declares {expected_size}. Upstream data "
            f"may have changed since the card was pinned — re-pin the card "
            f"before serving it."
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
        "source_dataset": f"{dataset_tag}-test-{src_code}_{tgt_code}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built %s corpus %s→%s (%s→%s, %d entries) at %s",
        dataset_tag, source_lang, target_lang, src_code, tgt_code,
        len(entries), dest,
    )
    return dest
