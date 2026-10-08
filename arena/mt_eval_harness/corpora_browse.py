"""
Corpus discovery — "what corpora exist for pair X→Y?" and "what is registered?"

The single source of truth for turning the dataset registry into a normalized,
display-ready view of the eval corpora. Shared by the guided interactive
selector, the non-interactive ``mt-eval corpora`` subcommand, and
``mt-eval list datasets``, so a human and an agent see exactly the same facts.

Pure data + formatting — no prompts, no I/O beyond loading the registry (and
an existence check for the handful of ``access: local`` files). The registry
is the SSOT: a ``pip install``ed harness with no monorepo still reads the
bundled / remote registry, so this works cold.

Availability vocabulary (``availability`` on every normalized entry):

    fetch        rebuilt on demand from the pinned upstream (fetch-from-source
                 with a corpora-card builder)
    gated        fetch, plus an accept-terms step and an access token
    local        an in-repo file that is present on this machine
    local-missing  declared in-repo but not found under any known base
    quarantined  catalogued, never runnable (improper subset, license hold,
                 or a schema fixture) — see ``quarantine_reason``
    unbuildable  fetch-from-source with no builder and no URL: catalogued but
                 the harness cannot materialize it

The MCP server's ``list_corpora`` tool carries a JS twin of
``normalize_entry`` (mcp-server/src/tools/corpora.js); keep the two in step.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from mt_eval_harness.config import _PACKAGE_DIR, _REGISTRY_DIR, load_registry


AVAILABILITY_VALUES = (
    "fetch", "gated", "local", "local-missing", "quarantined", "unbuildable",
)


# ---------------------------------------------------------------------------
# Normalization — one flat, stable shape regardless of registry entry vintage
# ---------------------------------------------------------------------------

def _local_bases() -> list[Path]:
    """The bases ``resolve_dataset`` tries for an in-repo file, same order."""
    bases = [
        _REGISTRY_DIR,                 # arena/datasets/ (registry-relative paths)
        _PACKAGE_DIR.parent.parent,    # monorepo root (in-repo checkout)
        _PACKAGE_DIR.parent,           # arena/ (installed-package layouts)
        Path.cwd(),                    # the caller's working directory
    ]
    env_root = os.environ.get("MT_EVAL_DATA_ROOT")
    if env_root:
        bases.insert(0, Path(env_root))
    return bases


def _local_file_exists(rel_path: str) -> bool:
    return any((base / rel_path).exists() for base in _local_bases())


def _availability(entry: dict[str, Any], *, gated: bool, builder: str | None) -> str:
    if entry.get("quarantine"):
        return "quarantined"
    access = entry.get("access")
    if access == "local":
        rel = entry.get("local_path") or entry.get("path")
        return "local" if rel and _local_file_exists(rel) else "local-missing"
    if access == "fetch-from-source":
        if not builder and not entry.get("url"):
            return "unbuildable"
        return "gated" if gated else "fetch"
    if entry.get("url"):
        return "fetch"
    return "unbuildable"


def normalize_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """Project a raw registry dataset entry to a stable CorpusInfo dict.

    Gated metadata is read from the entry top-level OR its ``source_export``
    block (build_registry writes both); either location wins.
    """
    pair = entry.get("language_pair") or {}
    export = entry.get("source_export") or {}

    gated = bool(entry.get("gated") or export.get("gated"))
    terms_url = entry.get("terms_url") or export.get("terms_url")
    token_env = entry.get("token_env") or export.get("token_env")
    builder = export.get("builder")
    quarantined = bool(entry.get("quarantine"))

    resolution = entry.get("language_resolution") or {}
    return {
        "id": entry.get("id"),
        "name": entry.get("name", ""),
        "source": pair.get("source"),
        "target": pair.get("target"),
        # the registry's resolved target code (Position 4 v2: script subtags
        # stripped, retirements/variety pins followed) — what the eval-pack
        # gate and the FST pins key on
        "target_resolved": ((resolution.get("target") or {}).get("resolved")
                            or pair.get("target")),
        "size": entry.get("size"),
        "domain": entry.get("domain"),
        # Contamination grade is a string (NONE/LOW/MEDIUM/HIGH) or None.
        "contamination": entry.get("contamination"),
        "license": entry.get("license"),
        "provider": entry.get("source"),  # publisher / corpus builder
        "attribution": entry.get("attribution"),
        "access": entry.get("access"),
        "do_not_train": entry.get("do_not_train", True),
        "segment": entry.get("segment"),
        "builder": builder,
        "gated": gated,
        "terms_url": terms_url if gated else None,
        "token_env": (token_env or "HF_TOKEN") if gated else None,
        "quarantine": quarantined,
        "quarantine_reason": (entry.get("quarantine_reason") or None) if quarantined else None,
        "family": entry.get("registry_source"),
        "availability": _availability(entry, gated=gated, builder=builder),
    }


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

def _load(registry_path: Path | None) -> list[dict[str, Any]]:
    registry = load_registry(registry_path)
    return registry.get("datasets", [])


def _side(code: str | None) -> str | None:
    code = (code or "").strip()
    return code or None


def _matches(entry: dict[str, Any], src: str | None, tgt: str | None) -> bool:
    """A registry entry's pair matches the given side(s); a side left None
    matches anything (one-sided filtering: ``--target sme`` alone lists every
    corpus into sme — it used to refuse without --source; synthetic
    researcher, Round 6)."""
    pair = entry.get("language_pair") or {}
    return ((src is None or pair.get("source") == src)
            and (tgt is None or pair.get("target") == tgt))


def list_corpora_for_pair(
    source: str | None,
    target: str | None,
    registry_path: Path | None = None,
    *,
    include_quarantined: bool = False,
) -> list[dict[str, Any]]:
    """Return normalized CorpusInfo dicts for a source→target pair — or for
    one side of it (either code may be None; at least one is required).

    Quarantined corpora (catalogued but not runnable) are excluded by default —
    a runnable view for both humans and agents. Results are sorted so the
    lowest-contamination, largest corpora surface first.
    """
    src, tgt = _side(source), _side(target)
    if src is None and tgt is None:
        raise ValueError("a source or a target code is required")
    out = []
    for entry in _load(registry_path):
        if not _matches(entry, src, tgt):
            continue
        info = normalize_entry(entry)
        if info["quarantine"] and not include_quarantined:
            continue
        out.append(info)

    out.sort(key=_sort_key)
    return out


def quarantined_for_pair(
    source: str | None, target: str | None, registry_path: Path | None = None,
) -> list[dict[str, Any]]:
    """The quarantined entries for a pair (or one side of it) — what the
    default view hides.

    Returned so an empty default view can SAY why it is empty instead of
    silently reporting zero corpora for a pair that is catalogued.
    """
    src, tgt = _side(source), _side(target)
    out = []
    for entry in _load(registry_path):
        if not _matches(entry, src, tgt):
            continue
        if entry.get("quarantine"):
            out.append(normalize_entry(entry))
    out.sort(key=lambda i: i.get("id") or "")
    return out


def list_all_corpora(
    registry_path: Path | None = None,
    *,
    source: str | None = None,
    target: str | None = None,
    family: str | None = None,
    include_quarantined: bool = False,
) -> tuple[list[dict[str, Any]], int]:
    """Every registered corpus (optionally filtered), plus the hidden count.

    Returns ``(infos, hidden_quarantined)`` where ``hidden_quarantined`` is the
    number of entries that matched the filters but were dropped because they
    are quarantined and ``include_quarantined`` is False. Sorted by
    ``(source, target, id)`` for a stable listing.
    """
    src = source.strip() if source else None
    tgt = target.strip() if target else None
    fam = family.strip() if family else None
    infos: list[dict[str, Any]] = []
    hidden = 0
    for entry in _load(registry_path):
        pair = entry.get("language_pair") or {}
        if src and pair.get("source") != src:
            continue
        if tgt and pair.get("target") != tgt:
            continue
        if fam and entry.get("registry_source") != fam:
            continue
        if entry.get("quarantine") and not include_quarantined:
            hidden += 1
            continue
        infos.append(normalize_entry(entry))
    infos.sort(key=lambda i: (i.get("source") or "", i.get("target") or "", i.get("id") or ""))
    return infos, hidden


def known_families(registry_path: Path | None = None) -> list[str]:
    """Sorted benchmark families (``registry_source`` values) in the registry."""
    return sorted({
        entry.get("registry_source")
        for entry in _load(registry_path)
        if entry.get("registry_source")
    })


_CONTAM_ORDER = {"NONE": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, None: 1}


def _sort_key(info: dict[str, Any]):
    contam = _CONTAM_ORDER.get(info.get("contamination"), 1)
    # Lower contamination first, then larger corpora first, then id for stability.
    size = info.get("size") or 0
    return (contam, -size, info.get("id") or "")


def available_source_langs(registry_path: Path | None = None) -> list[str]:
    """Sorted list of ISO source codes that have at least one runnable corpus."""
    srcs = set()
    for entry in _load(registry_path):
        if entry.get("quarantine"):
            continue
        pair = entry.get("language_pair") or {}
        if pair.get("source"):
            srcs.add(pair["source"])
    return sorted(srcs)


def available_targets_for_source(
    source: str, registry_path: Path | None = None,
) -> list[str]:
    """Sorted list of ISO target codes available for a given source."""
    src = source.strip()
    tgts = set()
    for entry in _load(registry_path):
        if entry.get("quarantine"):
            continue
        pair = entry.get("language_pair") or {}
        if pair.get("source") == src and pair.get("target"):
            tgts.add(pair["target"])
    return sorted(tgts)


def quarantined_only_targets_for_source(
    source: str, registry_path: Path | None = None,
) -> list[str]:
    """Targets that exist for a source ONLY as quarantined entries.

    These are invisible to ``available_targets_for_source``; surfacing them
    keeps a catalogued-but-held pair (eng→crk today) from looking unsupported.
    """
    src = source.strip()
    runnable, held = set(), set()
    for entry in _load(registry_path):
        pair = entry.get("language_pair") or {}
        if pair.get("source") != src or not pair.get("target"):
            continue
        (held if entry.get("quarantine") else runnable).add(pair["target"])
    return sorted(held - runnable)


# ---------------------------------------------------------------------------
# Optional human-readable language names (best-effort, never required)
# ---------------------------------------------------------------------------

def lang_name(code: str) -> str:
    """Resolve an ISO code to a human name, falling back to the code itself."""
    try:
        from mt_eval_harness.language_cards import get_name
        name = get_name(code)
        if name and name != code:
            return f"{name} ({code})"
    except Exception:
        pass
    return code


# ---------------------------------------------------------------------------
# Rendering — human table + structured (JSON-ready) form
# ---------------------------------------------------------------------------

#: The fst_state fields a ``--with-fst`` row carries.
_FST_FIELDS = ("analyzer_installed", "runtime_installed", "auto_install",
               "format", "setup_command", "line")


def with_fst(infos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Only the corpora whose TARGET language has an FST the harness pins
    (data/fst-pins.json — what `mt-eval setup --lang` can install and the
    FST metrics load), each annotated with ``fst``: what this machine has of
    that FST lane (config.fst_state — installed or not, automatic install
    or manual, the setup command, the one-line wording). The researcher
    persona checked languages one at a time to find this (Round 8).
    Installs and downloads nothing."""
    from mt_eval_harness.config import fst_state
    cache: dict[str, dict | None] = {}
    out = []
    for info in infos:
        code = info.get("target_resolved") or info.get("target")
        if not code:
            continue
        if code not in cache:
            try:
                cache[code] = fst_state(code)
            except Exception:  # noqa: BLE001 — an unreadable pin is "no pin"
                cache[code] = None
        state = cache[code]
        if state is None:
            continue
        out.append({**info, "fst": {k: state[k] for k in _FST_FIELDS}})
    return out


def fst_footer(infos: list[dict[str, Any]]) -> list[str]:
    """One line per distinct target of a ``--with-fst`` listing: the FST
    lane's state on this machine, in fst_state's words."""
    seen: dict[str, str] = {}
    for info in infos:
        code = info.get("target_resolved") or info.get("target")
        if code and code not in seen and info.get("fst"):
            seen[code] = info["fst"]["line"]
    if not seen:
        return []
    return (["  FST for each target (pinned by this harness; nothing "
             "downloads by itself):"]
            + [f"    {line}" for line in seen.values()] + [""])


def corpora_to_json(infos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return the JSON-serializable structured view (already plain dicts)."""
    return [dict(i) for i in infos]


def _reason_short(info: dict[str, Any], width: int = 110) -> str:
    reason = (info.get("quarantine_reason") or "no reason recorded").strip()
    reason = " ".join(reason.split())
    return reason if len(reason) <= width else reason[: width - 1] + "…"


def _quarantine_block(infos: list[dict[str, Any]], heading: str) -> list[str]:
    lines = [heading]
    for info in infos:
        lines.append(f"    • {info.get('id')} — {_reason_short(info)}")
    return lines


def format_corpora_table(
    infos: list[dict[str, Any]], source: str | None, target: str | None,
    hidden: list[dict[str, Any]] | None = None, *,
    with_fst_note: bool = False,
) -> str:
    """Render a detailed human-readable table of corpora for a pair — or for
    one side of it (``source`` or ``target`` None), with a Pair column.

    ``hidden`` is the list of quarantined entries the default view dropped;
    when the runnable list is empty but ``hidden`` is not, the table says so
    and names each entry with its quarantine reason, instead of reporting a
    catalogued pair as "none found".
    """
    source, target = _side(source), _side(target)
    one_sided = source is None or target is None
    if source and target:
        header = (f"  Corpora available for {lang_name(source)} → "
                  f"{lang_name(target)}:")
    elif target:
        header = f"  Corpora available into {lang_name(target)} (any source):"
    elif source:
        header = f"  Corpora available from {lang_name(source)} (any target):"
    else:
        header = "  Corpora available (any pair):"
    if with_fst_note:
        header = header.rstrip(":") + (" — only targets with an FST this "
                                       "harness pins (--with-fst):")
    hidden = hidden or []
    if not infos:
        if not hidden:
            return (
                f"{header}\n\n"
                f"  (none found)\n\n"
                f"  Try a different pair, or list source languages with:\n"
                f"    mt-eval corpora --list-sources\n"
            )
        n = len(hidden)
        lines = [header, "", "  (none runnable)", ""]
        lines += _quarantine_block(
            hidden,
            f"  {n} quarantined entr{'y' if n == 1 else 'ies'} hidden "
            f"(catalogued, never runnable):",
        )
        lines += ["", "  Pass --include-quarantined to list them.", ""]
        return "\n".join(lines)

    pair_h = f"{'Pair':9s} " if one_sided else ""
    pair_r = f"{'-'*9} " if one_sided else ""
    lines = [
        "",
        header,
        "",
        f"  {'#':>3} {pair_h}{'ID':40s} {'Size':>6s} {'Contam':7s} "
        f"{'Domain':13s} {'License':14s} {'Gated':5s} {'Provider'}",
        f"  {'-'*3} {pair_r}{'-'*40} {'-'*6} {'-'*7} {'-'*13} {'-'*14} "
        f"{'-'*5} {'-'*20}",
    ]
    for i, info in enumerate(infos, 1):
        gated = "yes" if info.get("gated") else "no"
        contam = info.get("contamination") or "?"
        size = info.get("size")
        size_s = str(size) if size is not None else "?"
        mark = f"Q{i}" if info.get("quarantine") else str(i)
        pair = (f"{(info.get('source') or '?')}>{(info.get('target') or '?')}"
                if one_sided else "")
        pair_c = f"{pair[:9]:9s} " if one_sided else ""
        lines.append(
            f"  {mark:>3} {pair_c}{(info.get('id') or '')[:40]:40s} "
            f"{size_s:>6s} {contam:7s} {(info.get('domain') or '?')[:13]:13s} "
            f"{(info.get('license') or '?')[:14]:14s} {gated:5s} "
            f"{(info.get('provider') or '')[:30]}"
        )
    lines.append("")
    # Footnote any gated corpora with their exact accept-terms instructions.
    gated_infos = [i for i in infos if i.get("gated")]
    if gated_infos:
        lines.append("  Gated corpora need accept-terms + an access token:")
        for info in gated_infos:
            lines.append(
                f"    • {info['id']}: accept terms at {info.get('terms_url')} "
                f"then set {info.get('token_env')}"
            )
        lines.append("")
    # Footnote quarantined rows that were listed on request (Q prefix).
    listed_q = [i for i in infos if i.get("quarantine")]
    if listed_q:
        lines += _quarantine_block(
            listed_q, "  Q = quarantined (catalogued, never runnable):")
        lines.append("")
    if hidden:
        n = len(hidden)
        lines.append(
            f"  {n} quarantined entr{'y' if n == 1 else 'ies'} hidden "
            f"(--include-quarantined to list them)")
        lines.append("")
    lines += fst_footer(infos)
    lines.append(
        "  Run one with:  mt-eval run --corpus <ID> --attest-no-training"
    )
    lines.append("")
    return "\n".join(lines)


_AVAIL_LABEL = {
    "fetch": "fetch",
    "gated": "gated",
    "local": "local ✓",
    "local-missing": "local ✗",
    "quarantined": "Q",
    "unbuildable": "nobuild",
}


def format_datasets_table(
    infos: list[dict[str, Any]],
    *,
    total: int,
    hidden_quarantined: int,
    limit: int | None = 60,
    filters: dict[str, Any] | None = None,
) -> str:
    """Render the registry listing for ``mt-eval list datasets``.

    ``infos`` is the full filtered list; at most ``limit`` rows are printed
    (``None`` = all) and the footer says how many were shown of ``total``.
    Column widths fit the longest registry id (46 chars) so alignment never
    collapses, and the legend describes what the harness can actually do with
    each row — nothing here is labelled "private" by default.
    """
    if not infos and not hidden_quarantined:
        return "  No datasets registered."

    shown = infos if limit is None else infos[:limit]
    filt = {k: v for k, v in (filters or {}).items() if v}
    filt_s = (
        "  Filters: " + ", ".join(f"{k}={v}" for k, v in filt.items())
        if filt else ""
    )
    hidden_s = (
        f"{hidden_quarantined:,} quarantined hidden; --include-quarantined"
        if hidden_quarantined else "no quarantined entries hidden"
    )
    lines = [
        "",
        f"  Registered evaluation datasets — {total:,} listed ({hidden_s})",
    ]
    if filt_s:
        lines.append(filt_s)
    lines += [
        "",
        f"  {'ID':46s} {'Pair':9s} {'Size':>6s} {'Contam':7s} {'License':24s} "
        f"{'Avail':8s} {'Family'}",
        f"  {'-'*46} {'-'*9} {'-'*6} {'-'*7} {'-'*24} {'-'*8} {'-'*14}",
    ]
    for info in shown:
        pair = f"{info.get('source') or '?'}→{info.get('target') or '?'}"
        size = info.get("size")
        size_s = f"{size:,}" if isinstance(size, int) else (str(size) if size else "?")
        lic = info.get("license") or "?"
        lic = lic if len(lic) <= 24 else lic[:23] + "…"
        lines.append(
            f"  {(info.get('id') or ''):46s} {pair:9s} {size_s:>6s} "
            f"{(info.get('contamination') or '?'):7s} {lic:24s} "
            f"{_AVAIL_LABEL.get(info.get('availability'), '?'):8s} "
            f"{info.get('family') or ''}"
        )
    lines.append("")
    if len(shown) < len(infos):
        lines.append(
            f"  Showing 1–{len(shown):,} of {total:,}  "
            f"(--limit N · --all · --source X --target Y --family F · --json)")
    else:
        lines.append(
            f"  Showing {len(shown):,} of {total:,}  "
            f"(--source X --target Y --family F · --json)")
    lines += [
        "",
        "  Avail: fetch = rebuilt on demand from the pinned upstream · "
        "gated = fetch + access token (see mt-eval corpora)",
        "         local ✓/✗ = in-repo file present/missing · "
        "Q = quarantined (catalogued, never runnable) · nobuild = no builder",
        "",
        "  Use: mt-eval run --corpus <dataset-id>       (resolves from registry)",
        "       mt-eval run --corpus <local_path.json>  (direct file path)",
        "       mt-eval corpora --source X --target Y   (detail for one pair)",
    ]
    return "\n".join(lines)
