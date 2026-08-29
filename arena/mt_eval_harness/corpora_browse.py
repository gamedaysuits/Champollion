"""
Corpus discovery — "what corpora exist for pair X→Y?"

The single source of truth for turning the dataset registry into a normalized,
display-ready view of the eval corpora available for a language pair. Shared by
both the guided interactive selector and the non-interactive ``mt-eval
corpora`` subcommand, so a human and an agent see exactly the same facts.

Pure data + formatting — no prompts, no I/O beyond loading the registry. The
registry is the SSOT: a ``pip install``ed harness with no monorepo still reads
the bundled / remote registry, so this works cold.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from mt_eval_harness.config import load_registry


# ---------------------------------------------------------------------------
# Normalization — one flat, stable shape regardless of registry entry vintage
# ---------------------------------------------------------------------------

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

    return {
        "id": entry.get("id"),
        "name": entry.get("name", ""),
        "source": pair.get("source"),
        "target": pair.get("target"),
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
        "quarantine": bool(entry.get("quarantine")),
    }


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

def _load(registry_path: Path | None) -> list[dict[str, Any]]:
    registry = load_registry(registry_path)
    return registry.get("datasets", [])


def list_corpora_for_pair(
    source: str,
    target: str,
    registry_path: Path | None = None,
    *,
    include_quarantined: bool = False,
) -> list[dict[str, Any]]:
    """Return normalized CorpusInfo dicts for an exact source→target pair.

    Quarantined corpora (catalogued but not runnable) are excluded by default —
    a runnable view for both humans and agents. Results are sorted so the
    lowest-contamination, largest corpora surface first.
    """
    src, tgt = source.strip(), target.strip()
    out = []
    for entry in _load(registry_path):
        pair = entry.get("language_pair") or {}
        if pair.get("source") != src or pair.get("target") != tgt:
            continue
        info = normalize_entry(entry)
        if info["quarantine"] and not include_quarantined:
            continue
        out.append(info)

    out.sort(key=_sort_key)
    return out


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

def corpora_to_json(infos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return the JSON-serializable structured view (already plain dicts)."""
    return [dict(i) for i in infos]


def format_corpora_table(
    infos: list[dict[str, Any]], source: str, target: str,
) -> str:
    """Render a detailed human-readable table of corpora for a pair."""
    header = f"  Corpora available for {lang_name(source)} → {lang_name(target)}:"
    if not infos:
        return (
            f"{header}\n\n"
            f"  (none found)\n\n"
            f"  Try a different pair, or list source languages with:\n"
            f"    mt-eval corpora --list-sources\n"
        )

    lines = [
        "",
        header,
        "",
        f"  {'#':>2} {'ID':40s} {'Size':>6s} {'Contam':7s} {'Domain':13s} "
        f"{'License':14s} {'Gated':5s} {'Provider'}",
        f"  {'-'*2} {'-'*40} {'-'*6} {'-'*7} {'-'*13} {'-'*14} {'-'*5} {'-'*20}",
    ]
    for i, info in enumerate(infos, 1):
        gated = "yes" if info.get("gated") else "no"
        contam = info.get("contamination") or "?"
        size = info.get("size")
        size_s = str(size) if size is not None else "?"
        lines.append(
            f"  {i:>2} {(info.get('id') or '')[:40]:40s} {size_s:>6s} "
            f"{contam:7s} {(info.get('domain') or '?')[:13]:13s} "
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
    lines.append(
        "  Run one with:  mt-eval run --corpus <ID> --attest-no-training"
    )
    lines.append("")
    return "\n".join(lines)
