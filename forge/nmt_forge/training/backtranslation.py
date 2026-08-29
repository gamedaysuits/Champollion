"""Backtranslation lane — tagged, leak-screened, provenance-stamped.

Caswell, Kreutzer & Cherry (2019), "Tagged Back-Translation": synthetic
sources from a reverse model carry a source-side tag so the forward model
can exploit BT data without confusing it for real bitext.

The step everyone skips, made unskippable here: the MONOLINGUAL text is
leak-audited against every registered eval set BEFORE any translation
happens — harvested target-language text has a way of BEING the eval set
(the reference screen caught the Okimāsis harvest 489/489: the harvest was
the gold textbook).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from ..guards.leak_audit import leak_audit
from ..workspace import Workspace


@dataclass
class BTResult:
    rows: list[dict]
    manifest: dict = field(default_factory=dict)


def backtranslate(
    mono_lines: list[str],
    reverse_translate: Callable[[list[str]], list[str]],
    workspace: Workspace,
    *,
    tag: str = "<bt>",
    model_id: str = "reverse-model",
    canonicalizer=None,
    out_path: str | Path | None = None,
) -> BTResult:
    """mono target-language lines → tagged synthetic training rows."""
    # screen the mono text itself (it is TARGET-language text: check the
    # target lane of every registered set, dev included — mono harvests that
    # overlap dev quietly bias checkpoint selection too)
    probe_rows = [{"source": "", "target": line} for line in mono_lines]
    report = leak_audit(probe_rows, workspace, canonicalizer=canonicalizer)
    leaking = report.leaking_row_indices
    clean_lines = [l for i, l in enumerate(mono_lines) if i not in leaking]
    if canonicalizer is not None:
        clean_lines = [canonicalizer(l) for l in clean_lines]

    sources = reverse_translate(clean_lines) if clean_lines else []
    if len(sources) != len(clean_lines):
        from ..errors import ScoringError

        raise ScoringError(
            f"reverse model returned {len(sources)} translations for "
            f"{len(clean_lines)} lines — a silent skip here misaligns every "
            "pair after it"
        )
    rows = [
        {
            "source": f"{tag} {src}",
            "target": line,
            "kind": "backtranslation",
            "origin": "backtranslation",
            "provenance": f"champollion-derived [tagged back-translation via "
                          f"{model_id}; Caswell et al. 2019]",
            "synthetic": True,
        }
        for src, line in zip(sources, clean_lines)
    ]
    manifest = {
        "guard": "backtranslation",
        "mono_lines": len(mono_lines),
        "leaking_lines_removed": len(leaking),
        "rows": len(rows),
        "tag": tag,
        "model_id": model_id,
        "leak_audit": report.to_manifest(),
    }
    if out_path is not None:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
            encoding="utf-8",
        )
        out_path.with_name(out_path.stem + "-manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    return BTResult(rows=rows, manifest=manifest)
